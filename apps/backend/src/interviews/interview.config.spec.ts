// interview.config.spec.ts
import { describe, expect, it } from 'vitest';
import { readInterviewConfig } from './interview.config';

const FULL = {
  ELEVENLABS_API_KEY: 'k',
  ELEVENLABS_AGENT_ID: 'agent',
  ELEVENLABS_WEBHOOK_SECRET: 'wsec',
  ELEVENLABS_LLM_SECRET: 'lsec',
  INTERVIEW_TURN_PROVIDER: 'anthropic',
  INTERVIEW_TURN_MODEL: 'claude-haiku-4-5-20251001',
  INTERVIEW_TURN_API_KEY: 't',
  INTERVIEW_REASONING_PROVIDER: 'anthropic',
  INTERVIEW_REASONING_MODEL: 'claude-sonnet-5',
  INTERVIEW_REASONING_API_KEY: 'r',
  INTERVIEW_CONSENT_VERSION: '2026-11-09',
};

describe('readInterviewConfig', () => {
  it('is enabled when every variable is set', () => {
    const c = readInterviewConfig(FULL);
    expect(c.enabled).toBe(true);
    expect(c.turn).toEqual({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001', apiKey: 't' });
    expect(c.maxSeconds).toBe(1800);
  });

  it.each(Object.keys(FULL).filter((k) => k !== 'INTERVIEW_CONSENT_VERSION'))('is disabled without %s', (key) => {
    const env: Record<string, string | undefined> = { ...FULL, [key]: undefined };
    expect(readInterviewConfig(env).enabled).toBe(false);
  });

  it('defaults the consent version', () => {
    expect(readInterviewConfig({ ...FULL, INTERVIEW_CONSENT_VERSION: undefined }).consentVersion).toBe('2026-11-09');
  });

  it('never borrows the article-AI or search keys', () => {
    const env = { ...FULL, INTERVIEW_TURN_API_KEY: undefined, ANTHROPIC_API_KEY: 'shared', OPENAI_API_KEY: 'shared' };
    expect(readInterviewConfig(env).enabled).toBe(false);
  });
});
