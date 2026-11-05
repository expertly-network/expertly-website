import { describe, expect, it } from 'vitest';
import { rateErrors } from './rate-errors';

describe('rate field errors', () => {
  it('marks only maximum when maximum is outside the bounds', () => {
    expect(rateErrors('50', '5001')).toEqual({ rateMaxDollars: 'Maximum rate must be between $10 and $5,000/hour.' });
  });
  it('marks only minimum when minimum is outside the bounds', () => {
    expect(Object.keys(rateErrors('9', '100'))).toEqual(['rateMinDollars']);
  });
  it('rejects decimals', () => {
    expect(rateErrors('50.5', '100')).toEqual({ rateMinDollars: 'Enter a whole number, without decimals.' });
  });
  it('places the ordering error on maximum, with no limit on the gap', () => {
    expect(Object.keys(rateErrors('100', '50'))).toEqual(['rateMaxDollars']);
    expect(Object.keys(rateErrors('100', '100'))).toEqual(['rateMaxDollars']);
    expect(rateErrors('10', '5000')).toEqual({});
  });
  it('marks missing fields independently', () => {
    expect(Object.keys(rateErrors('', '100'))).toEqual(['rateMinDollars']);
    expect(Object.keys(rateErrors('50', ''))).toEqual(['rateMaxDollars']);
  });
});
