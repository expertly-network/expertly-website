import { describe, expect, it } from 'vitest';
import { chunked, mapChunks } from './batched';

describe('chunked', () => {
  it('splits into fixed-size chunks with a short tail', () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunked([], 3)).toEqual([]);
  });
});

describe('mapChunks', () => {
  it('returns results in chunk order and never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapChunks([1, 2, 3, 4, 5, 6, 7], 2, 2, async (chunk, index) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, (4 - index) * 2));
      inFlight--;
      return chunk.reduce((a, b) => a + b, 0);
    });
    expect(results).toEqual([3, 7, 11, 7]);
    expect(peak).toBe(2);
  });

  it('rejects with the first failure and starts no further chunks', async () => {
    const started: number[] = [];
    await expect(
      mapChunks([1, 2, 3, 4], 1, 1, async (_chunk, index) => {
        started.push(index);
        if (index === 1) throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(started).toEqual([0, 1]);
  });
});
