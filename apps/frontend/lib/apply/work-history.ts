// Client-side mirror of apps/backend/src/common/work-history.ts, so the wizard can sort roles and
// flag bad dates inline before saving. Overlaps are only a warning (the backend allows them).

export interface WorkSpan {
  startYear: number;
  startMonth?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  isCurrent: boolean;
}

// year * 12 + (month - 1); a missing month counts as January for both start and end.
function monthIndex(year: number, month?: number | null): number {
  return year * 12 + ((month ?? 1) - 1);
}

function startOf(w: WorkSpan): number {
  return monthIndex(w.startYear, w.startMonth);
}

// A current role counts as ending today; an open-ended past role as ending at its start.
function endOf(w: WorkSpan, now: Date): number {
  if (w.isCurrent) return now.getFullYear() * 12 + now.getMonth();
  if (w.endYear == null || w.endYear === 0) return startOf(w);
  return monthIndex(w.endYear, w.endMonth);
}

// Entries without a start year are still being filled in and are skipped by the checks.
function isDated(w: WorkSpan): boolean {
  return Boolean(w.startYear);
}

// Newest first: later start wins, then later end. Undated (in-progress) rows sink to the bottom.
export function sortWorkHistoryNewestFirst<T extends WorkSpan>(items: T[], now: Date = new Date()): T[] {
  return [...items].sort((a, b) => {
    if (isDated(a) !== isDated(b)) return isDated(a) ? -1 : 1;
    if (!isDated(a)) return 0;
    return startOf(b) - startOf(a) || endOf(b, now) - endOf(a, now);
  });
}

export function isEndBeforeStart(w: WorkSpan, now: Date = new Date()): boolean {
  return isDated(w) && endOf(w, now) < startOf(w);
}

// Returns, per index of `items`, the index of another role it overlaps (touching in a boundary
// month is allowed), or -1. Used to put an inline error on every offending card.
export function findOverlaps(items: WorkSpan[], now: Date = new Date()): number[] {
  const result = items.map(() => -1);
  for (let i = 0; i < items.length; i++) {
    if (!isDated(items[i])) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (!isDated(items[j])) continue;
      if (startOf(items[i]) < endOf(items[j], now) && startOf(items[j]) < endOf(items[i], now)) {
        if (result[i] === -1) result[i] = j;
        if (result[j] === -1) result[j] = i;
      }
    }
  }
  return result;
}

// Whole years from the earliest started role to today — career length, so gaps still count (how
// senior professionals state seniority: "20 years in tax"). Only cards with a title or company
// count: a blank card's start year defaults to this year. Null when there's nothing to go on.
export function careerYears(
  items: (WorkSpan & { title?: string; company?: string })[],
  now: Date = new Date()
): number | null {
  const starts = items.filter((w) => isDated(w) && (w.title?.trim() || w.company?.trim())).map((w) => startOf(w));
  if (starts.length === 0) return null;
  const months = now.getFullYear() * 12 + now.getMonth() - Math.min(...starts);
  return Math.min(Math.max(Math.floor(months / 12), 0), 60);
}
