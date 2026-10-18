import { BadRequestException } from '@nestjs/common';

// Shared by the membership application (WorkExperienceDto) and the member self-edit
// `work_experiences` section — both carry year (required) and month (optional) fields.
export interface WorkSpan {
  title?: string;
  company?: string;
  startYear: number;
  startMonth?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  isCurrent: boolean;
}

// Month index (year * 12 + month-1). A missing month counts as January for both start and end,
// so year-only histories like 2015-2018 then 2018-2020 touch at a boundary instead of colliding.
function monthIndex(year: number, month?: number | null): number {
  return year * 12 + ((month ?? 1) - 1);
}

function startOf(w: WorkSpan): number {
  return monthIndex(w.startYear, w.startMonth);
}

// A current role counts as ending today; an open-ended past role (no endYear) as ending at start.
function endOf(w: WorkSpan, now: Date): number {
  if (w.isCurrent) return now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (w.endYear == null) return startOf(w);
  return monthIndex(w.endYear, w.endMonth);
}

function label(w: WorkSpan): string {
  return [w.title, w.company].filter(Boolean).join(' at ') || 'a role';
}

// Newest first: later start wins, then later end. Pure — returns a new array.
export function sortWorkHistoryNewestFirst<T extends WorkSpan>(items: T[], now: Date = new Date()): T[] {
  return [...items].sort((a, b) => startOf(b) - startOf(a) || endOf(b, now) - endOf(a, now));
}

// Rejects an end before its start, and any two roles whose date ranges overlap (touching at a
// boundary month is allowed). Error bodies carry a stable `code` for the frontend.
export function assertValidWorkHistory(items: WorkSpan[], now: Date = new Date()): void {
  for (const w of items) {
    if (endOf(w, now) < startOf(w)) {
      throw new BadRequestException({
        code: 'WORK_HISTORY_END_BEFORE_START',
        message: `The end date for ${label(w)} is before its start date.`,
      });
    }
  }
  const sorted = sortWorkHistoryNewestFirst(items, now);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (startOf(sorted[i]) < endOf(sorted[j], now) && startOf(sorted[j]) < endOf(sorted[i], now)) {
        throw new BadRequestException({
          code: 'WORK_HISTORY_OVERLAP',
          message: `Work history overlaps: ${label(sorted[i])} and ${label(sorted[j])} cover the same dates.`,
        });
      }
    }
  }
}
