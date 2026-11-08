'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import type { EventDto, ListEventsQuery } from '@shared/event';
import { listEventsPage } from '@/lib/api/events';
import { EVENTS_API_MAX_PAGE_SIZE, toIsoDate } from '@/lib/api/events-query';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { formatMonthYear } from '@/lib/dates';

// How many events a month shows after each "Load more": growing batches, so even the busiest month
// (600+ events) is fully open in about five clicks without one click dumping hundreds on the page.
// Opens at 10; then +25, +50, +100, +200, and finally everything left.
export const MONTH_BATCH_TARGETS = [10, 35, 85, 185, 385] as const;

/** The number of events to show after `loads` loads (0 = the first). Infinity = all of them. */
export function monthTarget(loads: number): number {
  return MONTH_BATCH_TARGETS[loads] ?? Infinity;
}

/** The month heading shared by the paged (public) and the client-filtered (admin) event lists. */
export function MonthHeading({ month, first, count }: { month: string; first: boolean; count?: number }) {
  return (
    <div className="mb-1 flex items-baseline gap-3.5 sm:mb-[18px]">
      <span className="flex-none text-[clamp(22px,3vw,36px)] font-medium tracking-[-0.03em] text-ink">{month}</span>
      {count !== undefined && (
        <span className="flex-none text-sm text-ink-3">
          {count.toLocaleString('en-GB')} {count === 1 ? 'event' : 'events'}
        </span>
      )}
      {!first && <span className="h-px flex-1 bg-line" />}
    </div>
  );
}

// One calendar month of the public events list: asks the API for just this month (within the
// chosen date range), in growing batches (MONTH_BATCH_TARGETS) with its own "Load more". It waits until it's
// near the viewport before the first request, so a long range ("All dates") doesn't fire one
// request per month up front. A month with no matches for the current filters renders nothing.
export function EventsMonthSection({
  month,
  query,
  first,
  renderEvent,
}: {
  /** Any date in the month; only its year and month are used. */
  month: Date;
  /** The current filters — from/to are the whole list's range and get clamped to this month. */
  query: ListEventsQuery;
  first: boolean;
  renderEvent: (event: EventDto) => ReactNode;
}) {
  const [items, setItems] = useState<EventDto[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  // How many loads have succeeded (0 = only the first batch), and the load a retry should repeat.
  const [loads, setLoads] = useState(0);
  const [failedLoad, setFailedLoad] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // This month's window, clamped to the list's range ("Upcoming" starts today, not on the 1st).
  const monthStart = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const from = query.from && query.from > monthStart ? query.from : monthStart;
  const to = query.to && query.to < monthEnd ? query.to : monthEnd;

  // A month wholly outside the range has nothing to show (and the API rejects from > to).
  const outOfRange = from > to;

  // Loads the month's first `monthTarget(loads)` events in one request (the API pages in fixed-size
  // blocks, so a batch starting mid-list isn't a single request; re-reading the first N is, and it
  // keeps the list consistent). Only a month beyond EVENTS_API_MAX_PAGE_SIZE takes extra requests.
  async function load(attempt: number) {
    setLoading(true);
    setError(null);
    try {
      // After the first month, only events that start in this month: an event running across
      // several months is listed once, where it starts (the first month also keeps events
      // already running when the range begins).
      const base = { ...query, from, to, startFrom: first ? undefined : monthStart };
      const target = monthTarget(attempt);
      let result = await listEventsPage({
        ...base,
        page: 1,
        pageSize: Math.min(target, EVENTS_API_MAX_PAGE_SIZE),
      });
      const wanted = Math.min(target, result.total);
      let items = result.items;
      for (let p = 2; items.length < wanted && result.items.length > 0; p++) {
        result = await listEventsPage({ ...base, page: p, pageSize: EVENTS_API_MAX_PAGE_SIZE });
        items = [...items, ...result.items];
      }
      setItems(items.slice(0, wanted));
      setTotal(result.total);
      setLoads(attempt);
    } catch (err) {
      setFailedLoad(attempt);
      setError(apiErrorMessage(err, 'Could not load events. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  // First page once the section is within a screen or so of the viewport. The parent remounts
  // every section when the filters change, so this runs once per section per filter set.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || outOfRange) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void load(0);
      },
      { rootMargin: '800px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one first load per mount
  }, []);

  if (total === 0 || outOfRange) return null;

  const label = formatMonthYear(month);
  const remaining = total === null ? 0 : total - items.length;
  const nextShows = total === null ? 0 : Math.min(monthTarget(loads + 1), total) - items.length;
  const moreLabel =
    nextShows >= remaining
      ? `Show all ${remaining.toLocaleString('en-GB')} remaining`
      : `Show ${nextShows.toLocaleString('en-GB')} more · ${remaining.toLocaleString('en-GB')} left`;

  return (
    <section ref={sectionRef} aria-label={label} aria-busy={loading} className={first ? 'mt-5' : 'mt-10 sm:mt-[52px]'}>
      <MonthHeading month={label} first={first} count={total ?? undefined} />

      {items.length > 0 && <div>{items.map(renderEvent)}</div>}

      {total === null && !error && (
        <div className="space-y-3" aria-label={`Loading ${label}`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-bg-alt" />
          ))}
        </div>
      )}

      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-3">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load(failedLoad)}>
            Try again
          </Button>
        </div>
      ) : (
        remaining > 0 && (
          <div className="mt-4 flex justify-center sm:mt-6">
            <Button
              size="sm"
              disabled={loading}
              onClick={() => void load(loads + 1)}
              aria-label={loading ? undefined : `${moreLabel} from ${label}`}
              className="max-sm:w-full"
            >
              {loading ? 'Loading…' : moreLabel}
            </Button>
          </div>
        )
      )}
    </section>
  );
}
