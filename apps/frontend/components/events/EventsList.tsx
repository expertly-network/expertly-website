'use client';

import { useMemo, useState } from 'react';
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

// Client-side filtering over the full past+future set (same pattern as ArticlesGrid) — the
// design's own "Date range" control is a full mini-calendar date-picker (design/static_html/
// events.html); simplified here to preset ranges rather than reproducing a custom calendar
// widget for marginal value over presets, a deliberate scope call given the dataset is only
// dozens of events, not something a precise custom date needs to slice further.
export function EventsList({ events }: { events: EventDto[] }) {
  const [datePreset, setDatePreset] = useState<DatePreset>('upcoming');
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

  const hasFilters = datePreset !== 'upcoming' || countryFilter.length > 0 || formatFilter.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterPopover
          label="Date range"
          multi={false}
          searchable={false}
          options={DATE_PRESETS}
          selected={[datePreset]}
          onChange={(values) => setDatePreset((values[0] as DatePreset) ?? 'upcoming')}
        />
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={countryFilter}
          onChange={setCountryFilter}
        />
        {FORMAT_OPTIONS.map((opt) => {
          const active = formatFilter.includes(opt.value);
          // Matches design's `.env-fmt-pill` — a small leading dot (grey by default, tinted
          // when active) plus a per-format active color: In Person tints `--ok` (green), Hybrid
          // tints `--accent` (teal) — previously both used the same accent tint regardless of
          // which format was selected.
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                active ? '' : 'border-line text-ink-2 hover:border-line-2'
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

      {groups.length > 0 ? (
        <div className="mt-5">
          {groups.map(([month, monthEvents], i) => (
            // Matches design's `.ev-month-group` (52px top margin, 20px for the first group) +
            // `.ev-month-header`'s flex row: the month name and a *separate* 1px `--line`-
            // colored divider that fills the remaining width, not a thick border under the
            // heading itself — the previous `border-b-2 border-ink` read as much darker/heavier
            // than the design's actual hairline divider, which was the "lines are so dark" bug.
            <div key={month} className={i === 0 ? 'mt-5' : 'mt-[52px]'}>
              <div className="mb-[18px] flex items-baseline gap-3.5">
                <span className="flex-none text-[clamp(26px,3vw,36px)] font-medium tracking-[-0.03em] text-ink">
                  {month}
                </span>
                {i > 0 && <span className="h-px flex-1 bg-line" />}
              </div>
              <div>
                {monthEvents.map((event, j) => (
                  <EventRow key={event.id} event={event} isMonthFirst={j === 0} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card padding="lg" className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="font-mono text-xs tracking-[0.04em] text-ink-3">No results</p>
          <p className="text-sm text-ink-3">No events match these filters yet.</p>
          {hasFilters && (
            <Button
              variant="secondary"
              onClick={() => {
                setDatePreset('upcoming');
                setCountryFilter([]);
                setFormatFilter([]);
              }}
            >
              Reset filters
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
