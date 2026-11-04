import { describe, expect, it } from 'vitest';
import { validRateRangeCents } from '@shared/consultation-rates';

describe('application consultation rates', () => {
  it('allows $20 as the floor, $500 as the ceiling and a $250 gap', () => {
    for (const pair of [
      [2000, 27000],
      [45000, 50000],
      [5000, 5001],
    ]) {
      expect(validRateRangeCents(...(pair as [number, number]))).toBe(true);
    }
  });
  it('rejects amounts outside the bounds, reversed ranges and gaps over $250', () => {
    for (const pair of [
      [1999, 5000],
      [45000, 50001],
      [2000, 27001],
      [5000, 5000],
      [7000, 5000],
      [NaN, 5000],
      [2000.5, 5000],
    ]) {
      expect(validRateRangeCents(...(pair as [number, number]))).toBe(false);
    }
  });
  it('validates partial draft amounts without requiring both', () => {
    expect(validRateRangeCents(null, undefined)).toBe(true);
    expect(validRateRangeCents(2000, null)).toBe(true);
    expect(validRateRangeCents(null, 50000)).toBe(true);
    expect(validRateRangeCents(null, 50001)).toBe(false);
  });
});
