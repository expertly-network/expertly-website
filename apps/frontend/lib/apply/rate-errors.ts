import { RATE_FLOOR, RATE_CEILING } from '@shared/consultation-rates';

const usd = (amount: number) => `$${amount.toLocaleString('en-US')}`;

/** Each rate is a whole number of dollars within the bounds; the maximum must exceed the minimum. */
export function rateErrors(minText: string, maxText: string): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, text, label] of [
    ['rateMinDollars', minText, 'Minimum'],
    ['rateMaxDollars', maxText, 'Maximum'],
  ]) {
    const trimmed = text.trim();
    if (!trimmed) errors[field] = `${label} rate is required.`;
    else if (!/^\d+$/.test(trimmed)) errors[field] = 'Enter a whole number, without decimals.';
    else if (Number(trimmed) < RATE_FLOOR || Number(trimmed) > RATE_CEILING)
      errors[field] = `${label} rate must be between ${usd(RATE_FLOOR)} and ${usd(RATE_CEILING)}/hour.`;
  }
  if (Object.keys(errors).length === 0 && Number(maxText) <= Number(minText)) {
    errors.rateMaxDollars = 'Maximum rate must be greater than minimum rate.';
  }
  return errors;
}
