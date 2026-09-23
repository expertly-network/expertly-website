'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button, Card, FilterPopover } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { EventRow } from '@/components/events/EventRow';
import type { EventDto, EventFormat } from '@shared/event';

type DatePreset = 'upcoming' | 'past' | 'this_month' | 'next_3_months' | 'all';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'this_month', label: 'This month' },
  { value: 'next_3_months', label: 'Next 3 months' },
  { value: 'past', label: 'Past events' },
  { value: 'all', label: 'All dates' },
];

const FORMAT_OPTIONS: { value: EventFormat; label: string }[] = [
  { value: 'in_person', label: 'In Person' },
  { value: 'hybrid', label: 'Hybrid' },
];

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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
  const [datePreset, setDatePreset] = useState<DatePreset>(defaultDatePreset);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<EventFormat[]>([]);

  const filtered = useMemo(() => {
    const today = startOfToday();
    const nextThreeMonths = new Date(today);
    nextThreeMonths.setMonth(nextThreeMonths.getMonth() + 3);

    return events.filter((e) => {
      const start = new Date(e.startDate);
      const end = e.endDate ? new Date(e.endDate) : start;

      let matchesDate = true;
      if (datePreset === 'upcoming') matchesDate = end >= today;
      else if (datePreset === 'past') matchesDate = end < today;
      else if (datePreset === 'this_month') {
        matchesDate = start.getMonth() === today.getMonth() && start.getFullYear() === today.getFullYear();
      } else if (datePreset === 'next_3_months') {
        matchesDate = start >= today && start <= nextThreeMonths;
      }

      const matchesCountry = countryFilter.length === 0 || (!!e.country && countryFilter.includes(e.country));
      const matchesFormat = formatFilter.length === 0 || (!!e.eventFormat && formatFilter.includes(e.eventFormat));
      return matchesDate && matchesCountry && matchesFormat;
    });
  }, [events, datePreset, countryFilter, formatFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, EventDto[]>();
    for (const e of filtered) {
      const key = MONTH_FORMAT.format(new Date(e.startDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  const hasFilters = datePreset !== defaultDatePreset || countryFilter.length > 0 || formatFilter.length > 0;

  const resetFilters = () => {
    setDatePreset(defaultDatePreset);
    setCountryFilter([]);
    setFormatFilter([]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line pb-[18px] pt-3.5">
        <FilterPopover
          label="Date range"
          multi={false}
          searchable={false}
          options={DATE_PRESETS}
          selected={[datePreset]}
          onChange={(values) => setDatePreset((values[0] as DatePreset) ?? defaultDatePreset)}
        />
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={countryFilter}
          onChange={setCountryFilter}
        />
        {FORMAT_OPTIONS.map((opt) => {
          const active = formatFilter.includes(opt.value);
          // In Person tints green, Hybrid tints teal.
          const activeColorVar = opt.value === 'in_person' ? '--ok' : '--accent';
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setFormatFilter((prev) =>
                  active ? prev.filter((f) => f !== opt.value) : [...prev, opt.value]
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] bg-bg-card px-3.5 py-2 font-mono text-[12px] font-semibold tracking-[0.04em] transition-colors ${
                active ? '' : 'border-line-2 text-ink-3 hover:border-ink-3 hover:text-ink'
              }`}
              style={
                active
                  ? {
                      borderColor: `color-mix(in oklab, var(${activeColorVar}) 35%, transparent)`,
                      background: `color-mix(in oklab, var(${activeColorVar}) 10%, var(--bg-card))`,
                      color: opt.value === 'in_person' ? 'color-mix(in oklab, var(--ok) 80%, #000)' : 'var(--accent)',
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
          <button
            type="button"
            onClick={resetFilters}
            className="font-mono text-[11px] font-semibold tracking-[0.05em] text-accent"
          >
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
          <div className="font-mono text-[11px] tracking-[0.12em] text-ink-4">No results</div>
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
