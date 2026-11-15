import { describe, expect, it } from 'vitest';
import { floorStat } from './stat-floor';

describe('floorStat', () => {
  it.each([
    [26, 25],
    [7, 5],
    [19, 15],
    [25, 25],
    [2, 2],
    [4, 4],
    [99, 95],
    [100, 100],
    [149, 100],
    [1234, 1200],
  ])('%i → %i+', (n, value) => {
    expect(floorStat(n)).toEqual({ value, plus: true });
  });
  it('keeps zero as a bare 0', () => {
    expect(floorStat(0)).toEqual({ value: 0, plus: false });
  });
});
