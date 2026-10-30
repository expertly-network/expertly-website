import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDayMonth, formatDayRange, formatMonthYear } from './dates';

const UTC = { utc: true };

describe('date formatting', () => {
  it('spells the full month with only its first letter capitalised', () => {
    expect(formatDate('2026-10-27T00:00:00Z', UTC)).toBe('27 October 2026');
    expect(formatDate('2026-10-27T00:00:00Z', UTC)).not.toMatch(/OCT|Oct /);
  });

  it('formats month-year and day-month', () => {
    expect(formatMonthYear('2024-03-01T00:00:00Z', UTC)).toBe('March 2024');
    expect(formatDayMonth('2026-11-02T00:00:00Z', UTC)).toBe('2 November');
  });

  it('formats a date with a lowercase time', () => {
    expect(formatDateTime('2026-10-27T15:45:00Z', UTC)).toBe('27 October 2026, 3:45 pm');
  });

  it('formats event date spans', () => {
    expect(formatDayRange('2026-10-27T00:00:00Z', null, UTC)).toBe('27 October');
    expect(formatDayRange('2026-10-27T00:00:00Z', '2026-10-27T10:00:00Z', UTC)).toBe('27 October');
    expect(formatDayRange('2026-10-27T00:00:00Z', '2026-10-29T00:00:00Z', UTC)).toBe('27–29 October');
    expect(formatDayRange('2026-10-30T00:00:00Z', '2026-11-02T00:00:00Z', UTC)).toBe('30 October – 2 November');
  });
});
