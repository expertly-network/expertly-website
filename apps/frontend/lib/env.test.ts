import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEnv(siteUrl: string | undefined) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
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
