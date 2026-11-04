import { describe, expect, it } from 'vitest';
import { rateErrors } from './rate-errors';

describe('rate field errors', () => {
  it('marks only maximum when maximum is outside the bounds', () => {
    expect(rateErrors('50', '2009')).toEqual({ rateMaxDollars: 'Maximum rate must be between $20 and $500/hour.' });
  });
  it('marks only minimum when minimum is outside the bounds', () => {
    expect(Object.keys(rateErrors('10', '100'))).toEqual(['rateMinDollars']);
  });
  it('places ordering and gap errors on maximum', () => {
    expect(Object.keys(rateErrors('100', '50'))).toEqual(['rateMaxDollars']);
    expect(Object.keys(rateErrors('20', '300'))).toEqual(['rateMaxDollars']);
  });
  it('marks missing fields independently and accepts valid boundary ranges', () => {
    expect(Object.keys(rateErrors('', '100'))).toEqual(['rateMinDollars']);
    expect(Object.keys(rateErrors('50', ''))).toEqual(['rateMaxDollars']);
    expect(rateErrors('20', '270')).toEqual({});
    expect(rateErrors('250', '500')).toEqual({});
    expect(rateErrors('50.01', '50.02')).toEqual({});
  });
});
