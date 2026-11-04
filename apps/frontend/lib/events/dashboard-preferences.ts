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
