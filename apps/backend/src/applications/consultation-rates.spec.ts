import { describe, expect, it } from 'vitest';
import { validRatesCents } from '@shared/consultation-rates';

describe('application consultation rates', () => {
  it('allows whole dollars from $10 to $5,000, with any gap', () => {
    for (const pair of [
      [1000, 500000],
      [1000, 1100],
      [499900, 500000],
    ]) {
      expect(validRatesCents(...(pair as [number, number]))).toBe(true);
    }
  });
  it('rejects amounts outside the bounds, cents, and a maximum not above the minimum', () => {
    for (const pair of [
      [900, 5000],
      [1000, 500100],
      [1050, 5000],
      [5000, 5000],
      [7000, 5000],
      [NaN, 5000],
      [2000.5, 5000],
    ]) {
      expect(validRatesCents(...(pair as [number, number]))).toBe(false);
    }
  });
  it('validates partial draft amounts without requiring both', () => {
    expect(validRatesCents(null, undefined)).toBe(true);
    expect(validRatesCents(1000, null)).toBe(true);
    expect(validRatesCents(null, 500000)).toBe(true);
    expect(validRatesCents(null, 500100)).toBe(false);
  });
});
