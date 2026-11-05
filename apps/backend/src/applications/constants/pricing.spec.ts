import { describe, expect, it } from 'vitest';
import { MEMBERSHIP_PRICE_CENTS } from './pricing';

describe('membership pricing', () => {
  it('quotes the advertised annual membership fee of $699 in cents', () => {
    expect(MEMBERSHIP_PRICE_CENTS.annual / 100).toBe(699);
  });
});
