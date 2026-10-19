import { describe, expect, it } from 'vitest';
import { matchStrength } from './match-strength';

describe('matchStrength', () => {
  it('labels by the default cut-offs (8 strong, 6 good)', () => {
    expect(matchStrength(10)).toEqual({ score: 10, label: 'strong', tier: 'best' });
    expect(matchStrength(8).label).toBe('strong');
    expect(matchStrength(7)).toEqual({ score: 7, label: 'good', tier: 'best' });
    expect(matchStrength(6).label).toBe('good');
    expect(matchStrength(5)).toEqual({ score: 5, label: 'possible', tier: 'related' });
    expect(matchStrength(3).tier).toBe('related');
  });
  it('clamps and tolerates bad input', () => {
    expect(matchStrength(14).score).toBe(10);
    expect(matchStrength(-2).score).toBe(0);
    expect(matchStrength(Number.NaN).label).toBe('possible');
  });
  it('honours custom cut-offs', () => {
    expect(matchStrength(7, { strong: 7, good: 5 }).label).toBe('strong');
  });
});
