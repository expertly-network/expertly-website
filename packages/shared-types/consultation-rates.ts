/** Hourly consultation rate bounds, in whole US dollars. */
export const RATE_FLOOR = 10;
export const RATE_CEILING = 5000;

/**
 * Partial drafts are allowed; every supplied amount must be a whole-dollar amount (in cents) within
 * the bounds, and when both are given the maximum must be greater than the minimum.
 */
export function validRatesCents(min: number | null | undefined, max: number | null | undefined): boolean {
  const validAmount = (value: number | null | undefined) =>
    value == null ||
    (Number.isInteger(value) && value % 100 === 0 && value >= RATE_FLOOR * 100 && value <= RATE_CEILING * 100);
  return validAmount(min) && validAmount(max) && (min == null || max == null || max > min);
}
