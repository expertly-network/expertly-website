import { formatMonthYear as formatMonthYearDate } from '@/lib/dates';

// Client-side display formatting for numeric rate/tenure fields.
export function formatTenure(years: number): string {
  return `${years}y`;
}

function currencySymbol(currency: string): string {
  return currency === 'USD' ? '$' : `${currency} `;
}

export function formatRate(minCents: number | null, maxCents: number | null, currency: string): string {
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

// A member-supplied link as a safe absolute `href`, or null when it isn't an http(s) address.
// Stored URLs may lack a scheme ("www.m2kadvisors.com" passes @IsUrl) — as an <a href> that's
// a relative path, which opened /members/www.m2kadvisors.com (404), so those link as https.
// Anything with another scheme (`javascript:`, `data:` …) is never linked: those values were
// accepted before the API validated them, and an href is where they'd execute.
// Mirrors apps/backend/src/common/http-url.ts `toHttpUrl` — change both together.
export function externalHref(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;

  let parsed: URL | null;
  try {
    parsed = new URL(value);
  } catch {
    parsed = null;
  }
  // "www.firm.com:8080/x" parses with protocol "www.firm.com:" — a host, not a scheme.
  if (!parsed || (!['http:', 'https:'].includes(parsed.protocol) && parsed.protocol.includes('.'))) {
    try {
      parsed = new URL(`https://${value.replace(/^\/+/, '')}`);
    } catch {
      return null;
    }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname.includes('.') || parsed.username || parsed.password) return null;
  return parsed.href;
}

// `{ href, label }` for a list row's optional link, or undefined when there's no safe URL.
export function externalLink(
  url: string | null | undefined,
  label: string
): { href: string; label: string } | undefined {
  const href = externalHref(url);
  return href ? { href, label } : undefined;
}

export function displayHost(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

// Testimonial `occurredOn` (ISO date) -> "March 2024".
export function formatMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatMonthYearDate(d, { utc: true });
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
