// Client-side mirror of the backend work-history rules (the server remains authoritative):
// newest-first ordering, and an end before its start rejected. Overlapping ranges are allowed
// (concurrent roles are real) but surfaced as a non-blocking warning. A current role ends today;
// a missing month counts as January; roles touching in one boundary month don't overlap.

export interface WorkHistoryRow {
  startYear?: unknown;
  startMonth?: unknown;
  endYear?: unknown;
  endMonth?: unknown;
  isCurrent?: unknown;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function range(row: WorkHistoryRow, now: Date): { start: number; end: number } | null {
  const sy = num(row.startYear);
  if (sy === null) return null;
  const start = sy * 12 + ((num(row.startMonth) ?? 1) - 1);
  let end: number;
  if (row.isCurrent) {
    end = now.getFullYear() * 12 + now.getMonth();
  } else {
    const ey = num(row.endYear);
    end = ey === null ? start : ey * 12 + ((num(row.endMonth) ?? 1) - 1);
  }
  return { start, end };
}

export function sortWorkHistory<T extends WorkHistoryRow>(rows: T[], now = new Date()): T[] {
  return [...rows].sort((a, b) => {
    const ra = range(a, now);
    const rb = range(b, now);
    if (!ra || !rb) return 0;
    return rb.start - ra.start || rb.end - ra.end;
  });
}

// Returns a map of row index -> blocking inline error (end before start).
export function workHistoryErrors(rows: WorkHistoryRow[], now = new Date()): Record<number, string> {
  const errors: Record<number, string> = {};
  rows.forEach((row, i) => {
    const r = range(row, now);
    if (r && r.end < r.start) errors[i] = 'End date is before the start date.';
  });
  return errors;
}

// Returns a map of row index -> non-blocking overlap warning, so a member can double-check the
// dates without being stopped from saving concurrent roles.
export function workHistoryWarnings(rows: WorkHistoryRow[], now = new Date()): Record<number, string> {
  const warnings: Record<number, string> = {};
  const ranges = rows.map((r) => range(r, now));
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (!a || !b || a.end < a.start || b.end < b.start) continue;
      if (a.start < b.end && b.start < a.end) {
        warnings[i] ??= `Overlaps with role ${j + 1} — fine if you held both at once, otherwise check the dates.`;
        warnings[j] ??= `Overlaps with role ${i + 1} — fine if you held both at once, otherwise check the dates.`;
      }
    }
  }
  return warnings;
}
