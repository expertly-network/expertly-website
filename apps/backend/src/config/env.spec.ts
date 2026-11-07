import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'sk-super-secret-value-123';

// env.ts caches the parsed result, so each case loads a fresh copy of the module.
async function loadEnvModule() {
  vi.resetModules();
  return import('./env');
}

class ExitCalled extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${code})`);
  }
}

let logged: string[];

beforeEach(() => {
  logged = [];
  vi.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
    logged.push(String(message));
  });
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitCalled(code);
  });
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SECRET);
  vi.stubEnv('CORS_ORIGINS', '');
  vi.stubEnv('OPENAI_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('loadApiEnv', () => {
  it('accepts a minimal development environment and applies defaults', async () => {
    const { loadApiEnv } = await loadEnvModule();
    expect(loadApiEnv()).toMatchObject({ NODE_ENV: 'development', PORT: 4000, ARTICLES_REVIEW_MODE: 'instant' });
  });

  it('refuses production without CORS_ORIGINS', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { loadApiEnv } = await loadEnvModule();
    expect(() => loadApiEnv()).toThrow(ExitCalled);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(logged).toContain('CORS_ORIGINS is required when NODE_ENV=production');
  });

  it('accepts production with an http(s) origin list', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGINS', 'https://growxq.com, https://www.growxq.com');
    const { loadApiEnv } = await loadEnvModule();
    expect(loadApiEnv().CORS_ORIGINS).toBe('https://growxq.com, https://www.growxq.com');
  });

  it('rejects a non-http CORS origin', async () => {
    vi.stubEnv('CORS_ORIGINS', 'https://growxq.com,javascript:alert(1)');
    const { loadApiEnv } = await loadEnvModule();
    expect(() => loadApiEnv()).toThrow(ExitCalled);
    expect(logged.some((l) => l.startsWith('CORS_ORIGINS '))).toBe(true);
  });

  it('names a missing variable as required, and treats an empty value as missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '   ');
    const { loadApiEnv } = await loadEnvModule();
    expect(() => loadApiEnv()).toThrow(ExitCalled);
    expect(logged).toContain('SUPABASE_SERVICE_ROLE_KEY is required');
  });

  it('never includes a variable value in the error output', async () => {
    vi.stubEnv('SUPABASE_URL', `ftp://${SECRET}`);
    vi.stubEnv('PORT', SECRET);
    vi.stubEnv('AI_PROVIDER', SECRET);
    const { loadApiEnv } = await loadEnvModule();
    expect(() => loadApiEnv()).toThrow(ExitCalled);
    expect(logged.length).toBeGreaterThanOrEqual(3);
    expect(logged.join('\n')).not.toContain(SECRET);
    expect(logged.some((l) => l.startsWith('SUPABASE_URL '))).toBe(true);
    expect(logged.some((l) => l.startsWith('PORT '))).toBe(true);
  });
});

describe('loadWorkerEnv', () => {
  it('requires OPENAI_API_KEY', async () => {
    const { loadWorkerEnv } = await loadEnvModule();
    expect(() => loadWorkerEnv()).toThrow(ExitCalled);
    expect(logged).toContain('OPENAI_API_KEY is required');
  });

  it('accepts the worker environment with a key', async () => {
    vi.stubEnv('OPENAI_API_KEY', SECRET);
    const { loadWorkerEnv } = await loadEnvModule();
    expect(loadWorkerEnv().OPENAI_API_KEY).toBe(SECRET);
  });
});

describe('env()', () => {
  it('throws (instead of exiting) with names only', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PORT', SECRET);
    const { env } = await loadEnvModule();
    let message = '';
    try {
      env();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('CORS_ORIGINS is required when NODE_ENV=production');
    expect(message).toContain('PORT');
    expect(message).not.toContain(SECRET);
    expect(process.exit).not.toHaveBeenCalled();
  });
});

describe('parseCorsOrigins', () => {
  it('splits, trims and drops empty entries', async () => {
    const { parseCorsOrigins } = await loadEnvModule();
    expect(parseCorsOrigins(' https://a.com, ,https://b.com ,')).toEqual(['https://a.com', 'https://b.com']);
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });
});

describe('email configuration (API and worker)', () => {
  it.each(['api', 'worker'])('requires Resend configuration in the %s process', async (entry) => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('OPENAI_API_KEY', SECRET);
    const module = await loadEnvModule();
    expect(() => (entry === 'api' ? module.loadApiEnv() : module.loadWorkerEnv())).toThrow(ExitCalled);
    expect(logged).toContain('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    expect(logged).toContain('EMAIL_FROM is required when EMAIL_PROVIDER=resend');
    expect(logged).toContain('SITE_URL is required when EMAIL_PROVIDER=resend');
  });
  it.each(['api', 'worker'])('refuses a production redirect in the %s process', async (entry) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ORIGINS', 'https://example.com');
    vi.stubEnv('OPENAI_API_KEY', SECRET);
    vi.stubEnv('EMAIL_REDIRECT_TO', 'dev@example.com');
    const module = await loadEnvModule();
    expect(() => (entry === 'api' ? module.loadApiEnv() : module.loadWorkerEnv())).toThrow(ExitCalled);
    expect(logged).toContain('EMAIL_REDIRECT_TO is forbidden when NODE_ENV=production');
  });
  it('defaults to simulated sending and disabled worker consumption', async () => {
    vi.stubEnv('EMAIL_PROVIDER', '');
    vi.stubEnv('EMAIL_WORKER_ENABLED', '');
    const { loadApiEnv } = await loadEnvModule();
    expect(loadApiEnv()).toMatchObject({ EMAIL_PROVIDER: 'log', EMAIL_WORKER_ENABLED: 'false' });
  });
});
