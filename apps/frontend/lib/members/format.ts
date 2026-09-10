// Client-side display formatting for numeric rate/tenure fields.
export function formatTenure(years: number): string {
  return `${years}y`;
}

export function formatRate(
  minCents: number | null,
  maxCents: number | null,
  currency: string
): string {
  if (minCents === null || maxCents === null) return 'Rate on request';
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  const min = Math.round(minCents / 100);
  const max = Math.round(maxCents / 100);
  return min === max ? `${symbol}${min} / hr` : `${symbol}${min} – ${symbol}${max} / hr`;
}
