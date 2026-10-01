// Client-side display formatting for numeric rate/tenure fields.
export function formatTenure(years: number): string {
  return `${years}y`;
}

function currencySymbol(currency: string): string {
  return currency === 'USD' ? '$' : `${currency} `;
}

export function formatRate(
  minCents: number | null,
  maxCents: number | null,
  currency: string
): string {
  if (minCents === null || maxCents === null) return 'Rate on request';
  const symbol = currencySymbol(currency);
  const min = Math.round(minCents / 100);
  const max = Math.round(maxCents / 100);
  return min === max ? `${symbol}${min} / hr` : `${symbol}${min} – ${symbol}${max} / hr`;
}

// Split form of formatRate for the profile sidebar's `.mp-fee-main`, which styles the min,
// the "– max" part, and "/ hr" at three different sizes. Null when there's no rate set.
export function formatRateParts(
  minCents: number | null,
  maxCents: number | null,
  currency: string
): { min: string; max: string | null } | null {
  if (minCents === null || maxCents === null) return null;
  const symbol = currencySymbol(currency);
  const min = Math.round(minCents / 100);
  const max = Math.round(maxCents / 100);
  return { min: `${symbol}${min}`, max: min === max ? null : `${symbol}${max}` };
}

// "2019 – Present" and a LinkedIn-style duration ("7 yrs"). Year-only precision, since the
// contract stores start/end years, not months.
export function formatWorkPeriod(
  startYear: number,
  endYear: number | null,
  isCurrent: boolean,
  now: number = new Date().getFullYear()
): { range: string; duration: string | null } {
  const end = isCurrent ? now : endYear;
  const range = `${startYear} – ${isCurrent ? 'Present' : (endYear ?? '')}`.trim();
  if (end === null) return { range, duration: null };
  const years = end - startYear;
  const duration = years <= 0 ? '< 1 yr' : years === 1 ? '1 yr' : `${years} yrs`;
  return { range, duration };
}

// "https://www.m2kadvisors.in/" -> "m2kadvisors.in"
export function displayHost(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

// Testimonial `occurredOn` (ISO date) -> "Mar 2024".
export function formatMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
