'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Card, DateRangePicker, FilterPopover, startOfDay, type DateRange } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { EventRow } from '@/components/events/EventRow';
import type { EventDto, EventFormat, EventOrganiserDto, ListEventsQuery } from '@shared/event';
import type { CategoryDto } from '@shared/category';
import { EVENT_TYPES } from '@/lib/events/format';
import { getEventDays, getEventOrganisers, listEventsPage } from '@/lib/api/events';
import { toIsoDate } from '@/lib/api/events-query';
import { EventsMonthSection, MonthHeading } from '@/components/events/EventsMonthSection';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
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

// Two format toggles; a hybrid event counts as both. The list keeps events having every selected
// format: In Person → in-person + hybrid, Online → online + hybrid, both → hybrid only. The API
// still stores three values (in_person / virtual / hybrid), so the toggles map onto them here.
type FormatToggle = 'in_person' | 'online';

const FORMAT_TOGGLES: { value: FormatToggle; label: string }[] = [
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

// Day key (local) for the picker's "has events" dots.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// The filters as an API query (dates as local calendar days).
function toQuery(
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

// Two modes. Public /events (`remote`): the calendar is far too large to ship whole, so every filter
// change asks the API which months have matches (its first and last event), and each month then
// loads its own events a few at a time with its own "Load more" (EventsMonthSection). Admin
// (`events`): the full admin list is already loaded, so filtering stays client-side. `getAdminBadge`/`getAdminActions`
// are optional per-event render slots the admin page uses.
export function EventsList({
  events = [],
  remote,
  query,
  categories = [],
  defaultDatePreset = 'upcoming',
  getAdminBadge,
  getAdminActions,
  emptyMessage,
}: {
  events?: EventDto[];
  /** Match count for the default filters, server-rendered; turns on server-side filtering/paging. */
  remote?: { total: number };
  /** Keyword search from the page hero (?q=); the remote list is already filtered by it. */
  query?: string;
  /** The taxonomy, for the area/topic filters and the topic tags on each row. */
  categories?: CategoryDto[];
  defaultDatePreset?: DatePreset;
  getAdminBadge?: (event: EventDto) => ReactNode;
  getAdminActions?: (event: EventDto) => ReactNode;
  emptyMessage?: string;
}) {
  const defaultRange = useMemo(() => presetRange(defaultDatePreset), [defaultDatePreset]);
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<FormatToggle[]>([]);
  const [organiserFilter, setOrganiserFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [lineFilter, setLineFilter] = useState<string[]>([]);
  const [topicFilter, setTopicFilter] = useState<string[]>([]);
  // Service lines in taxonomy order, and topics (categories) narrowed to the chosen lines.
  const lineOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of categories) if (!seen.has(c.serviceLineId)) seen.set(c.serviceLineId, c.serviceLineName);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [categories]);
  const topicOptions = useMemo(
    () =>
      categories
        .filter((c) => lineFilter.length === 0 || lineFilter.includes(c.serviceLineId))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, lineFilter]
  );
  const topicNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const lineByTopicId = useMemo(() => new Map(categories.map((c) => [c.id, c.serviceLineId])), [categories]);

  // Organiser filter options: from the API in remote mode (every organiser with published events),
  // from the loaded list in admin mode. Most events first; the count rides along in the label.
  const [remoteOrganisers, setRemoteOrganisers] = useState<EventOrganiserDto[]>([]);
  useEffect(() => {
    if (!remote) return;
    let cancelled = false;
    getEventOrganisers()
      .then((list) => {
        if (!cancelled) setRemoteOrganisers(list);
      })
      .catch(() => {
        // The filter just doesn't appear; the list itself still works.
      });
    return () => {
      cancelled = true;
    };
  }, [remote]);
  const organiserOptions = useMemo(() => {
    let list = remoteOrganisers;
    if (!remote) {
      const counts = new Map<string, number>();
      for (const e of events) {
        if (e.organiserName?.trim()) counts.set(e.organiserName, (counts.get(e.organiserName) ?? 0) + 1);
      }
      list = [...counts]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
    return list.map((o) => ({ value: o.name, label: `${o.name} (${o.count.toLocaleString('en-GB')})` }));
  }, [remote, remoteOrganisers, events]);

  // Remote mode: the months that have matches for the current filters (first to last match).
  const remoteQuery = useMemo(
    () => toQuery(dateRange, countryFilter, formatFilter, typeFilter, query, lineFilter, topicFilter, organiserFilter),
    [dateRange, countryFilter, formatFilter, typeFilter, query, lineFilter, topicFilter, organiserFilter]
  );
  const [remoteMonths, setRemoteMonths] = useState<Date[] | null>(null);
  const [remoteTotal, setRemoteTotal] = useState(remote?.total ?? 0);
  const [loading, setLoading] = useState(!!remote);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  // The list is sorted by start date, so its first and last match (page size 1) bound the months
  // to show; months in between with no matches hide themselves once loaded.
  const loadMonths = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const first = await listEventsPage({ ...remoteQuery, page: 1, pageSize: 1 });
      if (id !== requestId.current) return;
      if (first.total === 0 || !first.items[0]) {
        setRemoteTotal(0);
        setRemoteMonths([]);
        return;
      }
      const last = first.total === 1 ? first : await listEventsPage({ ...remoteQuery, page: first.total, pageSize: 1 });
      if (id !== requestId.current) return;
      // An event that started before the range (it's still running) counts from the range's start.
      const rangeStart = dateRange.from;
      const firstStart = new Date(first.items[0].startDate);
      const start = rangeStart && rangeStart > firstStart ? rangeStart : firstStart;
      const end = new Date((last.items[0] ?? first.items[0]).startDate);
      const months: Date[] = [];
      for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= end; m.setMonth(m.getMonth() + 1)) {
        months.push(new Date(m));
      }
      setRemoteTotal(first.total);
      setRemoteMonths(months);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(apiErrorMessage(err, 'Could not load events. Please try again.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [remoteQuery, dateRange.from]);

  useEffect(() => {
    if (remote) void loadMonths();
  }, [remote, loadMonths]);

  // Remote mode: event days for the months the picker is showing, fetched as it opens/pages.
  const [remoteDays, setRemoteDays] = useState<Set<string>>(new Set());
  const daysRequestId = useRef(0);
  const loadDays = useCallback(
    (first: Date, last: Date) => {
      if (!remote) return;
      const id = ++daysRequestId.current;
      setRemoteDays(new Set());
      getEventDays(toIsoDate(first), toIsoDate(last))
        .then(({ days }) => {
          if (id === daysRequestId.current) setRemoteDays(new Set(days));
        })
        .catch(() => {
          if (id === daysRequestId.current) setRemoteDays(new Set());
        }); // dots are a hint; never block the picker
    },
    [remote]
  );

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

  const clientFiltered = useMemo(() => {
    if (remote) return [];
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
      const formats = formatsForToggles(formatFilter);
      const matchesFormat = !formats || (!!e.eventFormat && formats.includes(e.eventFormat));
      const matchesOrganiser =
        organiserFilter.length === 0 || (!!e.organiserName && organiserFilter.includes(e.organiserName));
      const matchesType = typeFilter.length === 0 || (!!e.eventType && typeFilter.includes(e.eventType));
      const matchesTopic = topicFilter.length === 0 || e.categoryIds.some((id) => topicFilter.includes(id));
      const matchesLine =
        lineFilter.length === 0 || e.categoryIds.some((id) => lineFilter.includes(lineByTopicId.get(id) ?? ''));
      return (
        matchesDate && matchesCountry && matchesFormat && matchesOrganiser && matchesType && matchesTopic && matchesLine
      );
    });
  }, [
    remote,
    events,
    dateRange,
    countryFilter,
    formatFilter,
    organiserFilter,
    typeFilter,
    topicFilter,
    lineFilter,
    lineByTopicId,
  ]);

  const groups = useMemo(() => {
    const map = new Map<string, EventDto[]>();
    for (const e of clientFiltered) {
      const key = formatMonthYear(new Date(e.startDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [clientFiltered]);

  const isDefaultRange =
    (dateRange.from?.getTime() ?? null) === (defaultRange.from?.getTime() ?? null) &&
    (dateRange.to?.getTime() ?? null) === (defaultRange.to?.getTime() ?? null);
  const hasFilters =
    !isDefaultRange ||
    countryFilter.length > 0 ||
    formatFilter.length > 0 ||
    organiserFilter.length > 0 ||
    typeFilter.length > 0 ||
    lineFilter.length > 0 ||
    topicFilter.length > 0;
  const resultCount = remote ? remoteTotal : clientFiltered.length;
  const showCount = !(remote && loading) && !loadError;
  const filtersKey = JSON.stringify(remoteQuery);
  const renderEvent = (event: EventDto) => (
    <EventRow
      key={event.id}
      event={event}
      topics={event.categoryIds.map((id) => topicNameById.get(id)).filter((n): n is string => !!n)}
      adminBadge={getAdminBadge?.(event)}
      adminActions={getAdminActions?.(event)}
    />
  );

  const resetFilters = () => {
    setDateRange(defaultRange);
    setCountryFilter([]);
    setFormatFilter([]);
    setOrganiserFilter([]);
    setTypeFilter([]);
    setLineFilter([]);
    setTopicFilter([]);
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
          hasEvent={(day) => (remote ? remoteDays.has(toIsoDate(day)) : eventDays.has(dayKey(day)))}
          onVisibleMonthsChange={remote ? loadDays : undefined}
        />
        {lineOptions.length > 0 && (
          <FilterPopover
            label="All areas"
            options={lineOptions}
            selected={lineFilter}
            onChange={(values) => {
              setLineFilter(values);
              // Drop topics that fall outside the newly chosen areas.
              setTopicFilter((prev) =>
                prev.filter((id) => values.length === 0 || values.includes(lineByTopicId.get(id) ?? ''))
              );
            }}
          />
        )}
        {topicOptions.length > 0 && (
          <FilterPopover label="All topics" options={topicOptions} selected={topicFilter} onChange={setTopicFilter} />
        )}
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={countryFilter}
          onChange={setCountryFilter}
        />
        {organiserOptions.length > 0 && (
          <FilterPopover
            label="All organisers"
            options={organiserOptions}
            selected={organiserFilter}
            onChange={setOrganiserFilter}
          />
        )}
        <FilterPopover
          label="All event types"
          options={EVENT_TYPES.map((t) => ({ value: t, label: t }))}
          selected={typeFilter}
          onChange={setTypeFilter}
        />
        {FORMAT_TOGGLES.map((opt) => {
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

      <div className="flex min-h-9 items-center justify-between gap-3 pt-4">
        <span className="flex flex-wrap items-center gap-2 text-sm text-ink-3" aria-live="polite">
          {showCount && (
            <span>
              <strong className="font-semibold text-ink">{resultCount.toLocaleString('en-GB')}</strong>{' '}
              {resultCount === 1 ? 'event' : 'events'}
              {query && <> matching &ldquo;{query}&rdquo;</>}
            </span>
          )}
          {query && (
            <Link href="/events" scroll={false} className="font-mono text-[11px] font-semibold text-accent">
              Clear search ✕
            </Link>
          )}
        </span>
        {hasFilters && (
          <button type="button" onClick={resetFilters} className="font-mono text-[11px] font-semibold text-accent">
            Clear all filters ✕
          </button>
        )}
      </div>

      {remote && loading && !loadError ? (
        <div className="mt-8 space-y-3" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-bg-alt" />
          ))}
        </div>
      ) : remote && remoteMonths && remoteMonths.length > 0 ? (
        <div className="mt-5">
          {remoteMonths.map((month, i) => (
            <EventsMonthSection
              key={`${filtersKey}|${month.getFullYear()}-${month.getMonth()}`}
              month={month}
              query={remoteQuery}
              first={i === 0}
              renderEvent={renderEvent}
            />
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="mt-5">
          {groups.map(([month, monthEvents], i) => (
            <div key={month} className={i === 0 ? 'mt-5' : 'mt-[52px]'}>
              <MonthHeading month={month} first={i === 0} />
              <div>{monthEvents.map(renderEvent)}</div>
            </div>
          ))}
        </div>
      ) : loadError ? null : !remote && events.length === 0 && emptyMessage ? (
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
      {loadError && (
        <Card padding="md" className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadMonths()}>
            Try again
          </Button>
        </Card>
      )}
    </div>
  );
}
