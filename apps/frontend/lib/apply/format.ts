// Display formatting shared by the application wizard's review step and the admin's application
// review page — one implementation, so the applicant and the reviewer see the same strings.

// Also the option labels for the wizard's month selects (BackgroundStep).
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

// 120000 -> "$1,200", 12050 -> "$120.50"; null -> "—".
export function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? USD.format(dollars).replace(/\.00$/, '') : USD.format(dollars);
}

function monthLabel(month: number | undefined): string {
  return month ? (MONTHS[month - 1] ?? '') : '';
}

// "Mar 2019 – Present", "2015 – Jun 2018", "2015 – —" when no end was given.
export function formatDateRange(
  startMonth: number | undefined,
  startYear: number,
  isCurrent: boolean,
  endMonth: number | undefined,
  endYear: number | undefined
): string {
  const start = [monthLabel(startMonth), startYear].filter(Boolean).join(' ');
  const end = isCurrent ? 'Present' : [monthLabel(endMonth), endYear].filter(Boolean).join(' ') || '—';
  return `${start} – ${end}`;
}
