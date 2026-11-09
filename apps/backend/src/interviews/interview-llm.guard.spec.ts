// interview-llm.guard.spec.ts
import { describe, expect, it } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { InterviewLlmGuard } from './interview-llm.guard';
import type { InterviewConfig } from './interview.config';

const config = { elevenLabs: { llmSecret: 'lsec' } } as unknown as InterviewConfig;
function ctx(headers: Record<string, string>, body: unknown): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers, body }) }) } as unknown as ExecutionContext;
}

describe('InterviewLlmGuard', () => {
  const guard = new InterviewLlmGuard(config);
  const body = { elevenlabs_extra_body: { sessionToken: 'tok' } };
  it('allows the right bearer and a session token', () => {
    expect(guard.canActivate(ctx({ authorization: 'Bearer lsec' }, body))).toBe(true);
  });
  it.each([{}, { authorization: 'Bearer nope' }, { authorization: 'lsec' }])('rejects bad auth %j', (headers) => {
    expect(() => guard.canActivate(ctx(headers as Record<string, string>, body))).toThrow(UnauthorizedException);
  });
  it('rejects a missing session token', () => {
    expect(() => guard.canActivate(ctx({ authorization: 'Bearer lsec' }, {}))).toThrow(UnauthorizedException);
  });
});
