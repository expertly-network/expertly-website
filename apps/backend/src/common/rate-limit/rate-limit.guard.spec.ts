import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpContext } from '../../../test/helpers/execution-context';
import { DEFAULT_RATE_LIMIT, RATE_LIMIT_KEY, type RateLimitPolicy } from './rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';

const T0 = new Date('2026-10-30T12:00:00.000Z');

function routeWith(policy?: RateLimitPolicy): () => void {
  const handler = () => undefined;
  if (policy) Reflect.defineMetadata(RATE_LIMIT_KEY, policy, handler);
  return handler;
}

function hit(guard: RateLimitGuard, userId: string | undefined, handler: () => void): true | HttpException {
  try {
    return guard.canActivate(httpContext({ headers: {}, user: userId ? { id: userId } : undefined }, handler)) as true;
  } catch (err) {
    if (err instanceof HttpException) return err;
    throw err;
  }
}

describe('RateLimitGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const tight: RateLimitPolicy = { bucket: 'tight', rules: [{ limit: 3, windowSeconds: 60 }] };

  it('allows up to the limit, then answers 429 RATE_LIMITED with retryAfterSeconds', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith(tight);
    for (let i = 0; i < 3; i++) expect(hit(guard, 'u1', route)).toBe(true);
    vi.advanceTimersByTime(10_000);

    const rejected = hit(guard, 'u1', route);
    expect(rejected).toBeInstanceOf(HttpException);
    const err = rejected as HttpException;
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse()).toEqual({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment and try again.',
      // The oldest hit (T0) leaves the 60s window 50s from now.
      retryAfterSeconds: 50,
    });
  });

  it('slides the window: the allowance comes back as old hits age out', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith(tight);
    for (let i = 0; i < 3; i++) hit(guard, 'u1', route);
    expect(hit(guard, 'u1', route)).toBeInstanceOf(HttpException);
    vi.advanceTimersByTime(60_000);
    expect(hit(guard, 'u1', route)).toBe(true);
  });

  it('does not count rejected requests against the caller', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith(tight);
    for (let i = 0; i < 3; i++) hit(guard, 'u1', route);
    for (let i = 0; i < 5; i++) expect(hit(guard, 'u1', route)).toBeInstanceOf(HttpException);
    vi.advanceTimersByTime(60_000);
    for (let i = 0; i < 3; i++) expect(hit(guard, 'u1', route)).toBe(true);
  });

  it('counts per user', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith(tight);
    for (let i = 0; i < 3; i++) hit(guard, 'u1', route);
    expect(hit(guard, 'u1', route)).toBeInstanceOf(HttpException);
    expect(hit(guard, 'u2', route)).toBe(true);
  });

  it('shares one allowance across routes in the same bucket, not across buckets', () => {
    const guard = new RateLimitGuard(new Reflector());
    const a = routeWith(tight);
    const b = routeWith(tight);
    const other = routeWith({ bucket: 'other', rules: [{ limit: 1, windowSeconds: 60 }] });
    hit(guard, 'u1', a);
    hit(guard, 'u1', b);
    hit(guard, 'u1', a);
    expect(hit(guard, 'u1', b)).toBeInstanceOf(HttpException);
    expect(hit(guard, 'u1', other)).toBe(true);
  });

  it('enforces every rule of a policy (burst and sustained)', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith({
      bucket: 'two-rules',
      rules: [
        { limit: 2, windowSeconds: 60 },
        { limit: 3, windowSeconds: 3600 },
      ],
    });
    hit(guard, 'u1', route);
    hit(guard, 'u1', route);
    expect(hit(guard, 'u1', route)).toBeInstanceOf(HttpException); // burst
    vi.advanceTimersByTime(61_000);
    expect(hit(guard, 'u1', route)).toBe(true);
    vi.advanceTimersByTime(61_000);
    const sustained = hit(guard, 'u1', route) as HttpException;
    expect(sustained).toBeInstanceOf(HttpException); // hourly
    expect((sustained.getResponse() as { retryAfterSeconds: number }).retryAfterSeconds).toBe(3600 - 122);
  });

  it('applies DEFAULT_RATE_LIMIT to routes without @RateLimit', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith();
    const { limit } = DEFAULT_RATE_LIMIT.rules[0];
    for (let i = 0; i < limit; i++) expect(hit(guard, 'u1', route)).toBe(true);
    expect(hit(guard, 'u1', route)).toBeInstanceOf(HttpException);
  });

  it('never counts anonymous requests', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith({ bucket: 'one', rules: [{ limit: 1, windowSeconds: 60 }] });
    for (let i = 0; i < 10; i++) expect(hit(guard, undefined, route)).toBe(true);
  });

  it('reports at least one second to wait', () => {
    const guard = new RateLimitGuard(new Reflector());
    const route = routeWith({ bucket: 'one', rules: [{ limit: 1, windowSeconds: 1 }] });
    hit(guard, 'u1', route);
    vi.advanceTimersByTime(999);
    const err = hit(guard, 'u1', route) as HttpException;
    expect((err.getResponse() as { retryAfterSeconds: number }).retryAfterSeconds).toBe(1);
  });
});
