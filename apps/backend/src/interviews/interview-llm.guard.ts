// interview-llm.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { InterviewConfig } from './interview.config';

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// 🌐 Provider-authenticated: only ElevenLabs knows the bearer secret; the session token then picks
// one live interview connection (checked again in TurnEngine).
@Injectable()
export class InterviewLlmGuard implements CanActivate {
  constructor(private readonly config: InterviewConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, unknown>; body: unknown }>();
    const secret = this.config.elevenLabs?.llmSecret;
    const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const extra = (req.body as { elevenlabs_extra_body?: { sessionToken?: unknown } } | null)?.elevenlabs_extra_body;
    if (!secret || !token || !safeEqual(token, secret) || typeof extra?.sessionToken !== 'string' || !extra.sessionToken)
      throw new UnauthorizedException({ code: 'INTERVIEW_LLM_UNAUTHORIZED', message: 'Unauthorized.' });
    return true;
  }
}
