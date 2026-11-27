import { describe, expect, it } from 'vitest';
import type { EventDto } from '@shared/event';
import { dashboardEventWindow, withinDashboardWindow } from './dashboard-preferences';

describe('dashboardEventWindow', () => {
  it('covers the rest of the month when 3+ days remain', () => {
    expect(dashboardEventWindow(new Date(2026, 10, 27))).toEqual({
      from: '2026-11-27',
      to: '2026-11-30',
      scope: 'month',
    });
  });
  it('switches to the next 3 days near the end of a month', () => {
    expect(dashboardEventWindow(new Date(2026, 10, 29))).toEqual({
      from: '2026-11-29',
      to: '2026-12-02',
      scope: 'days',
    });
    expect(dashboardEventWindow(new Date(2026, 11, 31))).toEqual({
      from: '2026-12-31',
      to: '2027-01-03',
      scope: 'days',
    });
  });
});

describe('withinDashboardWindow', () => {
  const ev = (id: string, startDate: string, endDate: string | null = null) => ({ id, startDate, endDate }) as EventDto;
  it('keeps events running in the window and drops later or finished ones', () => {
    const kept = withinDashboardWindow(
      [
        ev('ongoing', '2026-11-25T09:00:00Z', '2026-11-28T17:00:00Z'),
        ev('soon', '2026-11-30T09:00:00Z'),
        ev('later', '2026-12-05T09:00:00Z'),
        ev('over', '2026-11-20T09:00:00Z', '2026-11-22T17:00:00Z'),
      ],
      { from: '2026-11-27', to: '2026-11-30' }
    ).map((e) => e.id);
    expect(kept).toEqual(['ongoing', 'soon']);
  });
});
