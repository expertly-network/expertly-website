import { randomUUID } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../auth/supabase.service';
import { OpenAiClient } from './openai.client';
import { SearchController } from './search.controller';
import { SEARCH_THROTTLERS, SearchThrottlerGuard } from './search-throttler.guard';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';
import type { SearchOutcome } from './search.types';
import { TopicEmbeddingService } from './topic-embedding.service';

// In-process e2e: the real controller, validation pipe, throttler guard, SearchService and
// SearchRepository over a fake search_query_log table. Only auth (a stub guard reading the
// x-test-user header — no real token) and the AI/DB pipeline (runSearch is stubbed) are fake.

@Injectable()
class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: { id: string } }>();
    const id = request.headers['x-test-user'];
    if (!id) throw new UnauthorizedException('Missing bearer token.');
    request.user = { id };
    return true;
  }
}

type LogRow = Record<string, unknown> & { id: string };

function fakeSupabase(rows: LogRow[]): { db: { from: (table: string) => unknown } } {
  return {
    db: {
      from(table: string) {
        if (table !== 'search_query_log') throw new Error(`unexpected table ${table}`);
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const created: LogRow = { feedback: null, feedback_note: null, ...row, id: randomUUID() };
                rows.push(created);
                return { data: { id: created.id }, error: null };
              },
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            const filters: [string, unknown][] = [];
            const builder = {
              eq(column: string, value: unknown) {
                filters.push([column, value]);
                return builder;
              },
              then(resolve: (v: { error: null }) => void) {
                for (const r of rows) if (filters.every(([c, v]) => r[c] === v)) Object.assign(r, patch);
                resolve({ error: null });
              },
            };
            return builder;
          },
        };
      },
    },
  };
}

const OUTCOME: SearchOutcome = {
  answer: 'ok',
  results: [],
  plan: { doc_types: [], semantic_query: 'tax', countries: [], city: null, service_terms: [], date_from: null, date_to: null, max_hourly_rate_usd: null, requested_count: null },
  degraded: [],
  applied: { types: ['member'], topic: 'tax', countries: [], city: null, serviceIds: null, dateFrom: null, dateTo: null, maxHourlyRateUsd: null, relaxed: [] },
  debug: { topSimilarity: null, candidates: 0, judge: null, timings: { planner: 0, embedding: 0, hybrid: 0, judge: 0 } },
};

describe('POST /v1/search (e2e, stubbed auth)', () => {
  let app: NestFastifyApplication;
  let rows: LogRow[];

  beforeEach(async () => {
    rows = [];
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: SEARCH_THROTTLERS })],
      controllers: [SearchController],
      providers: [
        SearchService,
        SearchRepository,
        SearchThrottlerGuard,
        { provide: SupabaseService, useValue: fakeSupabase(rows) },
        { provide: OpenAiClient, useValue: {} },
        { provide: TopicEmbeddingService, useValue: {} },
        { provide: APP_GUARD, useClass: StubAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    vi.spyOn(app.get(SearchService), 'runSearch').mockResolvedValue(OUTCOME);
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (payload: unknown, user: string | null = 'user-a') =>
    app.inject({ method: 'POST', url: '/v1/search', headers: user ? { 'x-test-user': user } : {}, payload: payload as object });

  it('returns 401 without auth', async () => {
    const res = await post({ query: 'tax' }, null);
    expect(res.statusCode).toBe(401);
  });

  it('returns the camelCase contract and logs the question', async () => {
    const res = await post({ query: '  tax advisors  ' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(['answer', 'applied', 'degraded', 'logId', 'ms', 'results']);
    expect(body.applied.serviceIds).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: body.logId, user_id: 'user-a', source: 'user', question: 'tax advisors' });
  });

  it('returns 429 with retryAfterSeconds: 30 after 10 questions in a minute, per user', async () => {
    for (let i = 0; i < 10; i++) expect((await post({ query: 'tax' })).statusCode).toBe(200);
    const blocked = await post({ query: 'tax' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ statusCode: 429, retryAfterSeconds: 30 });
    expect(typeof blocked.json().message).toBe('string');
    // another user is unaffected
    expect((await post({ query: 'tax' }, 'user-b')).statusCode).toBe(200);
  });

  it('keeps feedback on its own looser bucket (30/min), separate from questions', async () => {
    for (let i = 0; i < 10; i++) await post({ query: 'tax' });
    expect((await post({ query: 'tax' })).statusCode).toBe(429);
    const logId = rows[0].id;
    for (let i = 0; i < 30; i++) expect((await post({ action: 'feedback', logId, rating: 1 })).statusCode).toBe(200);
    const blocked = await post({ action: 'feedback', logId, rating: 1 });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().retryAfterSeconds).toBe(30);
  });

  it('feedback updates only the caller\'s own search_query_log row', async () => {
    const aId = (await post({ query: 'tax' }, 'user-a')).json().logId as string;
    const bId = (await post({ query: 'tax' }, 'user-b')).json().logId as string;
    const rowOf = (id: string) => rows.find((r) => r.id === id) as LogRow;

    // user-b tries to rate user-a's answer: accepted without error, but nothing changes
    const foreign = await post({ action: 'feedback', logId: aId, rating: -1, note: 'hijack' }, 'user-b');
    expect(foreign.statusCode).toBe(200);
    expect(rowOf(aId).feedback).toBeNull();
    expect(rowOf(bId).feedback).toBeNull();

    // user-a rates their own answer; the note is truncated to 500 characters
    const own = await post({ action: 'feedback', logId: aId, rating: 1, note: 'x'.repeat(600) }, 'user-a');
    expect(own.json()).toEqual({ ok: true });
    expect(rowOf(aId).feedback).toBe(1);
    expect((rowOf(aId).feedback_note as string).length).toBe(500);
    expect(rowOf(bId).feedback).toBeNull();
  });

  it('rejects feedback without logId / with a bad rating', async () => {
    expect((await post({ action: 'feedback', rating: 1 })).statusCode).toBe(400);
    expect((await post({ action: 'feedback', logId: randomUUID(), rating: 5 })).statusCode).toBe(400);
  });

  it('returns 400 for a query of length 1 and 501, 200 at the 2 and 500 boundaries', async () => {
    expect((await post({ query: 'a' })).statusCode).toBe(400);
    expect((await post({ query: 'a'.repeat(501) })).statusCode).toBe(400);
    expect((await post({ query: 'ab' })).statusCode).toBe(200);
    expect((await post({ query: 'a'.repeat(500) })).statusCode).toBe(200);
    expect((await post({})).statusCode).toBe(400);
  });

  it('validates scope, limit and unknown fields', async () => {
    expect((await post({ query: 'tax', scope: 'bogus' })).statusCode).toBe(400);
    expect((await post({ query: 'tax', limit: 0 })).statusCode).toBe(400);
    expect((await post({ query: 'tax', limit: 21 })).statusCode).toBe(400);
    expect((await post({ query: 'tax', limit: 20, scope: 'members' })).statusCode).toBe(200);
    expect((await post({ query: 'tax', extra: true })).statusCode).toBe(400);
  });
});
