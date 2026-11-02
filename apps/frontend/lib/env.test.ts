import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEnv(siteUrl: string | undefined) {
  vi.resetModules();
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl ?? '');
  return import('./env');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('site origins', () => {
  it('uses the first configured origin as canonical', async () => {
    const env = await loadEnv('https://expertly.network/, https://dev.expertly.network');
    expect(env.getSiteUrl()).toBe('https://expertly.network');
  });

  it('picks the configured origin matching the request host', async () => {
    const env = await loadEnv('https://expertly.network,https://dev.expertly.network');
    expect(env.resolveSiteUrl('dev.expertly.network')).toBe('https://dev.expertly.network');
    expect(env.resolveSiteUrl('DEV.expertly.network, proxy.internal')).toBe('https://dev.expertly.network');
  });

  it('never resolves to a host outside the configured list', async () => {
    const env = await loadEnv('https://expertly.network,https://dev.expertly.network');
    expect(env.resolveSiteUrl('evil.example')).toBe('https://expertly.network');
    expect(env.resolveSiteUrl('expertly.network.evil.example')).toBe('https://expertly.network');
    expect(env.resolveSiteUrl(null)).toBe('https://expertly.network');
  });

  it('falls back to localhost outside production when unset', async () => {
    const env = await loadEnv(undefined);
    expect(env.resolveSiteUrl('anything')).toBe('http://localhost:3000');
  });
});

describe('runtime deployment config', () => {
  it('reads API_URL and the Supabase project from the runtime environment', async () => {
    const env = await loadEnv(undefined);
    vi.stubEnv('API_URL', 'https://api.example.test/');
    expect(env.getApiUrl()).toBe('https://api.example.test');
    expect(env.getSupabaseUrl()).toBe('https://project.supabase.co');
    expect(env.getSupabaseAnonKey()).toBe('anon');
  });

  it('refuses to fall back when API_URL is unset in production', async () => {
    const env = await loadEnv(undefined);
    vi.stubEnv('API_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => env.getApiUrl()).toThrow(/API_URL/);
  });

  it('fails loudly when the Supabase project is not configured', async () => {
    const env = await loadEnv(undefined);
    vi.stubEnv('SUPABASE_URL', '');
    expect(() => env.getSupabaseUrl()).toThrow(/SUPABASE_URL/);
  });

  it('round-trips through the injected script in the browser', async () => {
    const env = await loadEnv(undefined);
    vi.stubEnv('API_URL', 'https://api.example.test');
    const script = env.publicConfigScript();
    const fakeWindow: Record<string, unknown> = {};
    new Function('window', script)(fakeWindow);
    vi.stubGlobal('window', fakeWindow);
    try {
      expect(env.getApiUrl()).toBe('https://api.example.test');
      expect(env.getSupabaseUrl()).toBe('https://project.supabase.co');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
