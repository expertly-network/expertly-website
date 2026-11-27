import type { EventDto } from '@shared/event';

export interface DashboardEventPreferences {
  country: string[];
  sector: string[];
  location: string[];
}

export function parseDashboardEventPreferences(value: unknown): DashboardEventPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  const valid = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length <= 100 && v.every((s) => typeof s === 'string' && s.length <= 200);
  return valid(p.country) && valid(p.sector) && valid(p.location)
    ? { country: p.country, sector: p.sector, location: p.location }
    : null;
}

export function selectDashboardEvents(events: EventDto[], preferences: DashboardEventPreferences) {
  const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const hasPreferences = Object.values(preferences).some((values) => values.length);
  const matches = (e: EventDto) => [
    !preferences.country.length || preferences.country.some((v) => eq(v, e.country || '')),
    !preferences.sector.length || preferences.sector.some((v) => e.categoryIds.includes(v)),
    !preferences.location.length || preferences.location.some((v) => eq(v, e.city || '')),
  ];
  const strict = events.filter((e) => matches(e).every(Boolean));
  if (strict.length || !hasPreferences) return { events: strict, related: false };
  const related = events.filter((e) => {
    const m = matches(e);
    return (
      (preferences.country.length > 0 && m[0]) ||
      (preferences.sector.length > 0 && m[1]) ||
      (preferences.location.length > 0 && m[2])
    );
  });
  return { events: related, related: related.length > 0 };
}

// The dashboard lists only what's coming up soon: today through the end of this month, or the next
// 3 days when the month has fewer than 3 left (so late in the month the list doesn't go empty).
// Dates are the viewer's local calendar days, as YYYY-MM-DD.
export const DASHBOARD_EVENTS_MIN_DAYS = 3;

export function dashboardEventWindow(now: Date = new Date()): {
  from: string;
  to: string;
  scope: 'month' | 'days';
} {
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const minEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DASHBOARD_EVENTS_MIN_DAYS);
  const scope = monthEnd >= minEnd ? 'month' : 'days';
  return { from: ymd(now), to: ymd(scope === 'month' ? monthEnd : minEnd), scope };
}

// Events in the window: still running on or after `from`, and starting on or before `to`.
export function withinDashboardWindow(events: EventDto[], window: { from: string; to: string }): EventDto[] {
  return events.filter(
    (e) => e.startDate.slice(0, 10) <= window.to && (e.endDate ?? e.startDate).slice(0, 10) >= window.from
  );
}
