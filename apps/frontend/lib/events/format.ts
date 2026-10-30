// Shared event display formatting — used by the homepage's Upcoming Events section and,
// once built, the standalone Events page.

import { formatDayOfMonth, formatMonth } from '@/lib/dates';

export function formatEventMonth(iso: string): string {
  return formatMonth(iso);
}

export function formatEventDay(iso: string): string {
  return formatDayOfMonth(iso);
}

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In Person',
  virtual: 'Online',
  hybrid: 'Hybrid',
};

// An online event has no physical location — show "Online" wherever a location would go, never
// the city/country an admin may have filled in.
export function isOnlineEvent(event: { eventFormat: string | null }): boolean {
  return event.eventFormat === 'virtual';
}

export function formatEventFormat(format: string | null): string | null {
  return format ? (FORMAT_LABEL[format] ?? format) : null;
}
