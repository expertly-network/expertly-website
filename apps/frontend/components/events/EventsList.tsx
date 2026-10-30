'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button, Card, DateRangePicker, FilterPopover, startOfDay, type DateRange } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { EventRow } from '@/components/events/EventRow';
import type { EventDto, EventFormat } from '@shared/event';
import { formatMonthYear } from '@/lib/dates';

type DatePreset = 'upcoming' | 'past' | 'this_month' | 'next_3_months' | 'all';

// Quick picks offered next to the calendar; each resolves to a from–to range when chosen.
const DATE_PRESETS: { value: DatePreset; label: string; range: () => DateRange }[] = [
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

function presetRange(preset: DatePreset): DateRange {
  return (DATE_PRESETS.find((p) => p.value === preset) ?? DATE_PRESETS[0]).range();
}

const FORMAT_OPTIONS: { value: EventFormat; label: string }[] = [
  { value: 'in_person', label: 'In Person' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'virtual', label: 'Online' },
];

// Day key (local) for the picker's "has events" dots.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Client-side filtering over the full event set. Shared by the public and admin event lists;
// `getAdminBadge`/`getAdminActions` are optional per-event render slots the admin page uses.
export function EventsList({
  events,
  defaultDatePreset = 'upcoming',
  getAdminBadge,
  getAdminActions,
  emptyMessage,
}: {
  events: EventDto[];
  defaultDatePreset?: DatePreset;
  getAdminBadge?: (event: EventDto) => ReactNode;
  getAdminActions?: (event: EventDto) => ReactNode;
  emptyMessage?: string;
}) {
  const defaultRange = useMemo(() => presetRange(defaultDatePreset), [defaultDatePreset]);
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<EventFormat[]>([]);

  // Every day any event runs on, for the picker's dots.
  const eventDays = useMemo(() => {
    const days = new Set<string>();
    for (const e of events) {
      const day = startOfDay(new Date(e.startDate));
      const last = startOfDay(new Date(e.endDate ?? e.startDate));
      // Guard against a bad end date turning this into a long loop.
      for (let i = 0; day <= last && i < 62; i++) {
        days.add(dayKey(day));
        day.setDate(day.getDate() + 1);
      }
    }
    return days;
  }, [events]);

  const filtered = useMemo(() => {
    const from = dateRange.from;
    // `to` is inclusive: anything starting before the end of that day counts.
    const toExclusive = dateRange.to
      ? new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate() + 1)
      : null;

    return events.filter((e) => {
      const start = new Date(e.startDate);
      const end = e.endDate ? new Date(e.endDate) : start;
      // An event matches when any part of it falls inside the range.
      const matchesDate = (!from || end >= from) && (!toExclusive || start < toExclusive);
      const matchesCountry = countryFilter.length === 0 || (!!e.country && countryFilter.includes(e.country));
      const matchesFormat = formatFilter.length === 0 || (!!e.eventFormat && formatFilter.includes(e.eventFormat));
      return matchesDate && matchesCountry && matchesFormat;
    });
  }, [events, dateRange, countryFilter, formatFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, EventDto[]>();
    for (const e of filtered) {
      const key = formatMonthYear(new Date(e.startDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  const isDefaultRange =
    (dateRange.from?.getTime() ?? null) === (defaultRange.from?.getTime() ?? null) &&
    (dateRange.to?.getTime() ?? null) === (defaultRange.to?.getTime() ?? null);
  const hasFilters = !isDefaultRange || countryFilter.length > 0 || formatFilter.length > 0;

  const resetFilters = () => {
    setDateRange(defaultRange);
    setCountryFilter([]);
    setFormatFilter([]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line pb-[18px] pt-3.5">
        <DateRangePicker
          prefix="When:"
          value={dateRange}
          onChange={setDateRange}
          presets={DATE_PRESETS.map((p) => ({ label: p.label, range: p.range }))}
          clearValue={defaultRange}
          hasEvent={(day) => eventDays.has(dayKey(day))}
        />
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={countryFilter}
          onChange={setCountryFilter}
        />
        {FORMAT_OPTIONS.map((opt) => {
          const active = formatFilter.includes(opt.value);
          // Both formats tint the brand green (--ok is an alias of --accent).
          const activeColorVar = opt.value === 'in_person' ? '--ok' : '--accent';
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setFormatFilter((prev) => (active ? prev.filter((f) => f !== opt.value) : [...prev, opt.value]))
              }
              className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] bg-bg-card px-3.5 py-2 font-mono text-[12px] font-semibold transition-colors ${
                active ? '' : 'border-line-2 text-ink-3 hover:border-ink-3 hover:text-ink'
              }`}
              style={
                active
                  ? {
                      borderColor: `color-mix(in oklab, var(${activeColorVar}) 35%, transparent)`,
                      background: `color-mix(in oklab, var(${activeColorVar}) 10%, var(--bg-card))`,
                      color: 'var(--accent)',
                    }
                  : undefined
              }
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 flex-none rounded-full"
                style={{ background: active ? `var(${activeColorVar})` : 'var(--line-2)' }}
              />
              {opt.label}
            </button>
          );
        })}
      </div>

      {hasFilters && (
        <div className="flex justify-end pt-4">
          <button type="button" onClick={resetFilters} className="font-mono text-[11px] font-semibold text-accent">
            Clear all filters ✕
          </button>
        </div>
      )}

      {groups.length > 0 ? (
        <div className="mt-5">
          {groups.map(([month, monthEvents], i) => (
            <div key={month} className={i === 0 ? 'mt-5' : 'mt-[52px]'}>
              <div className="mb-[18px] flex items-baseline gap-3.5">
                <span className="flex-none text-[clamp(26px,3vw,36px)] font-medium tracking-[-0.03em] text-ink">
                  {month}
                </span>
                {i > 0 && <span className="h-px flex-1 bg-line" />}
              </div>
              <div>
                {monthEvents.map((event, j) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    isMonthFirst={j === 0}
                    adminBadge={getAdminBadge?.(event)}
                    adminActions={getAdminActions?.(event)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 && emptyMessage ? (
        <Card padding="lg" className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-ink-3">{emptyMessage}</p>
        </Card>
      ) : (
        <div className="py-16 text-center">
          <div className="font-mono text-[11px] text-ink-4">No results</div>
          <h3 className="mb-5 mt-2.5 text-[22px] font-medium tracking-[-0.02em] text-ink">
            No events match these filters.
          </h3>
          {hasFilters && (
            <Button variant="secondary" onClick={resetFilters}>
              Clear all filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
