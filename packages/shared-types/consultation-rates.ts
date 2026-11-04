export const RATE_FLOOR = 20;
export const RATE_CEILING = 500;
export const RATE_MAX_SPREAD = 250;

/** Partial draft ranges are allowed; every supplied amount must still be valid. */
export function validRateRangeCents(min: number | null | undefined, max: number | null | undefined): boolean {
  const validAmount = (value: number | null | undefined) =>
    value == null || (Number.isInteger(value) && value >= RATE_FLOOR * 100 && value <= RATE_CEILING * 100);
  return (
    validAmount(min) &&
    validAmount(max) &&
    (min == null || max == null || (max > min && max - min <= RATE_MAX_SPREAD * 100))
  );
}
