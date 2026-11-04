import { RATE_FLOOR, RATE_CEILING, RATE_MAX_SPREAD } from '@shared/consultation-rates';

export function rateErrors(minText: string, maxText: string): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, text, label] of [
    ['rateMinDollars', minText, 'Minimum'],
    ['rateMaxDollars', maxText, 'Maximum'],
  ]) {
    const amount = Number(text);
    if (!text.trim()) errors[field] = `${label} rate is required.`;
    else if (!Number.isFinite(amount) || amount < RATE_FLOOR || amount > RATE_CEILING)
      errors[field] = `${label} rate must be between $${RATE_FLOOR} and $${RATE_CEILING}/hour.`;
    else if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)
      errors[field] = 'Use no more than two decimal places.';
  }
  if (Object.keys(errors).length === 0) {
    const min = Math.round(Number(minText) * 100);
    const max = Math.round(Number(maxText) * 100);
    if (max <= min) errors.rateMaxDollars = 'Maximum rate must be greater than minimum rate.';
    else if (max - min > RATE_MAX_SPREAD * 100)
      errors.rateMaxDollars = `Maximum rate must be no more than $${RATE_MAX_SPREAD} above minimum rate.`;
  }
  return errors;
}
