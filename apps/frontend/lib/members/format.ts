// GET /v1/members intentionally omits display strings ("18y", "$420/hr") —
// docs/rest-api.md: format them client-side from the numeric fields. These
// two functions are that formatting, used by MemberCard and ProfileSidebar.

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
  return min === max ? `${symbol}${min}/hr` : `${symbol}${min}–${max}/hr`;
}
