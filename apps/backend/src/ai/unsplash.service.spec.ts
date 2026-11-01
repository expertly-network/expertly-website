import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsplashService, shuffle } from './unsplash.service';

describe('UnsplashService.search', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('asks for a 30-photo pool and returns a random 10 of it', async () => {
    vi.stubEnv('UNSPLASH_ACCESS_KEY', 'test-key');
    const urls = Array.from({ length: 30 }, (_, i) => `https://img/${i}`);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: urls.map((regular) => ({ urls: { regular } })) }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const images = await new UnsplashService().search('gst');

    expect(new URL(fetchMock.mock.calls[0][0] as URL).searchParams.get('per_page')).toBe('30');
    expect(images).toHaveLength(10);
    expect(new Set(images).size).toBe(10);
    expect(images.every((u) => urls.includes(u))).toBe(true);
  });
});

describe('shuffle', () => {
  it('keeps every element', () => {
    expect(shuffle([1, 2, 3, 4, 5], () => 0.3).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
