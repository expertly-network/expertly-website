import type { DateRange } from '@/components/ui';
import { startOfDay } from '@/components/ui/DateRangePicker';
import { toIsoDate } from '@/lib/api/events-query';
import type { EventFormat, ListEventsQuery } from '@shared/event';

// Filter definitions shared by the events list (desktop dropdowns) and its phone filter sheet.

export type DatePreset = 'upcoming' | 'past' | 'this_month' | 'next_3_months' | 'all';

// Quick picks offered next to the calendar; each resolves to a from–to range when chosen.
export const DATE_PRESETS: { value: DatePreset; label: string; range: () => DateRange }[] = [
  { value: 'upcoming', label: 'Upcoming', range: () => ({ from: startOfDay(new Date()), to: null }) },
  {
    value: 'this_month',
    label: 'This month',
    range: () => {
      const t = new Date();
      return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: new Date(t.getFullYear(), t.getMonth() + 1, 0) };
    },
  },
  {
    value: 'next_3_months',
    label: 'Next 3 months',
    range: () => {
      const from = startOfDay(new Date());
      const to = new Date(from);
      to.setMonth(to.getMonth() + 3);
      return { from, to };
    },
  },
  {
    value: 'past',
    label: 'Past events',
    range: () => {
      const to = startOfDay(new Date());
      to.setDate(to.getDate() - 1);
      return { from: null, to };
    },
  },
  { value: 'all', label: 'All dates', range: () => ({ from: null, to: null }) },
];

export function presetRange(preset: DatePreset): DateRange {
  return (DATE_PRESETS.find((p) => p.value === preset) ?? DATE_PRESETS[0]).range();
}

// Two format toggles; a hybrid event counts as both. The list keeps events having every selected
// format: In Person → in-person + hybrid, Online → online + hybrid, both → hybrid only. The API
// still stores three values (in_person / virtual / hybrid), so the toggles map onto them here.
export type FormatToggle = 'in_person' | 'online';

export const FORMAT_TOGGLES: { value: FormatToggle; label: string }[] = [
  { value: 'in_person', label: 'In Person' },
  { value: 'online', label: 'Online' },
];

export function formatsForToggles(toggles: FormatToggle[]): EventFormat[] | undefined {
  const inPerson = toggles.includes('in_person');
  const online = toggles.includes('online');
  if (inPerson && online) return ['hybrid'];
  if (inPerson) return ['in_person', 'hybrid'];
  if (online) return ['virtual', 'hybrid'];
  return undefined;
}

// The filters as an API query (dates as local calendar days).
export function toQuery(
  range: DateRange,
  country: string[],
  format: FormatToggle[],
  type: string[],
  q: string | undefined,
  lines: string[],
  topics: string[],
  organisers: string[]
): ListEventsQuery {
  return {
    organiser: organisers.length ? organisers : undefined,
    q,
    serviceLineId: lines.length ? lines : undefined,
    categoryId: topics.length ? topics : undefined,
    from: range.from ? toIsoDate(range.from) : undefined,
    to: range.to ? toIsoDate(range.to) : undefined,
    country: country.length ? country : undefined,
    format: formatsForToggles(format),
    type: type.length ? type : undefined,
  };
}
