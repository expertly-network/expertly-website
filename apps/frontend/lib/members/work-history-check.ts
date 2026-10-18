// Client-side mirror of the backend work-history rules (the server remains authoritative):
// newest-first ordering, and overlapping date ranges rejected. A current role ends today;
// a missing month counts as January; roles touching in one boundary month are allowed.

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

// Returns a map of row index -> inline error message.
export function workHistoryErrors(rows: WorkHistoryRow[], now = new Date()): Record<number, string> {
  const errors: Record<number, string> = {};
  const ranges = rows.map((r) => range(r, now));
  ranges.forEach((r, i) => {
    if (r && r.end < r.start && !errors[i]) errors[i] = 'End date is before the start date.';
  });
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (!a || !b) continue;
      if (a.start < b.end && b.start < a.end) {
        errors[i] ??= `Overlaps with role ${j + 1}. Roles cannot overlap in time.`;
        errors[j] ??= `Overlaps with role ${i + 1}. Roles cannot overlap in time.`;
      }
    }
  }
  return errors;
}
