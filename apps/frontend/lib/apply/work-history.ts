// Client-side mirror of apps/backend/src/common/work-history.ts, so the wizard can sort and flag
// overlapping roles inline before saving. The backend remains the authority and re-checks.

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
