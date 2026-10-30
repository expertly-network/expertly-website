import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type ArgumentsHost,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter, type ApiErrorBody } from './http-exception.filter';

function capture(exception: unknown): { status: number; body: ApiErrorBody } {
  const sent: { status: number; body: ApiErrorBody } = { status: 0, body: {} as ApiErrorBody };
  const reply = {
    status(code: number) {
      sent.status = code;
      return reply;
    },
    send(body: ApiErrorBody) {
      sent.body = body;
      return reply;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({ id: 'req-1' }) }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return sent;
}

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
    logged.push(String(message));
  });
});

describe('HttpExceptionFilter', () => {
  it('passes a 4xx code, message and documented extras through', () => {
    const { status, body } = capture(
      new ConflictException({ code: 'CONSULTATION_PENDING', message: 'Already pending.', retryAfter: '2026-11-01' })
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      statusCode: 409,
      code: 'CONSULTATION_PENDING',
      message: 'Already pending.',
      retryAfter: '2026-11-01',
    });
    expect(logged).toEqual([]);
  });

  it('gives a code-less 4xx its status default code', () => {
    // Nest's own `error` label ("Not Found") rides along; the contract fields are what matter.
    expect(capture(new NotFoundException('Article not found.')).body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Article not found.',
    });
    expect(capture(new HttpException('Teapot', 418)).body).toMatchObject({ code: 'HTTP_418', message: 'Teapot' });
  });

  it('labels DTO / ParsePipe validation failures VALIDATION_FAILED', () => {
    expect(capture(new BadRequestException(['title must be a string'])).body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: ['title must be a string'],
    });
    expect(capture(new BadRequestException('Validation failed (uuid is expected)')).body.code).toBe(
      'VALIDATION_FAILED'
    );
  });

  it('keeps an explicit code on a 403', () => {
    expect(capture(new ForbiddenException({ code: 'ROLE_REQUIRED', message: 'Requires role: member.' })).body).toEqual({
      statusCode: 403,
      code: 'ROLE_REQUIRED',
      message: 'Requires role: member.',
    });
  });

  it('replaces a 5xx message with a generic one and logs the original', () => {
    const { status, body } = capture(new InternalServerErrorException('relation "profiles" does not exist'));
    expect(status).toBe(500);
    expect(body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' });
    expect(JSON.stringify(body)).not.toContain('profiles');
    expect(logged.join('\n')).toContain('relation "profiles" does not exist');
    expect(logged.join('\n')).toContain('reqId=req-1');
  });

  it('keeps a 5xx code but uses its fixed client-safe sentence', () => {
    const { body } = capture(
      new ServiceUnavailableException({
        code: 'AI_NOT_CONFIGURED',
        message: 'OPENAI_API_KEY missing for provider openai',
      })
    );
    expect(body).toEqual({
      statusCode: 503,
      code: 'AI_NOT_CONFIGURED',
      message: 'AI features are not available right now.',
    });
  });

  it('uses the status sentence for an unlisted 5xx code', () => {
    expect(capture(new ServiceUnavailableException({ code: 'SOMETHING', message: 'pg pool exhausted' })).body).toEqual({
      statusCode: 503,
      code: 'SOMETHING',
      message: 'Service temporarily unavailable.',
    });
  });

  it('turns an unknown error into a generic 500', () => {
    const { status, body } = capture(new Error('ECONNREFUSED 10.0.0.5:5432'));
    expect(status).toBe(500);
    expect(body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' });
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('maps a Fastify 4xx error (e.g. body too large) to its status code', () => {
    const err = Object.assign(new Error('Request body is too large'), {
      statusCode: 413,
      code: 'FST_ERR_CTP_BODY_TOO_LARGE',
    });
    expect(capture(err).body).toEqual({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    });
  });

  it('does not trust a Fastify-like error claiming a 5xx status', () => {
    const err = Object.assign(new Error('internal detail'), { statusCode: 502 });
    expect(capture(err).body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' });
  });
});
