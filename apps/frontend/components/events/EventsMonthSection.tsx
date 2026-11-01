'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import type { EventDto, ListEventsQuery } from '@shared/event';
import { listEventsPage } from '@/lib/api/events';
import { toIsoDate } from '@/lib/api/events-query';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { formatMonthYear } from '@/lib/dates';

// Events shown per month before (and added by each) "Load more".
export const EVENTS_PER_MONTH = 6;

/** The month heading shared by the paged (public) and the client-filtered (admin) event lists. */
export function MonthHeading({ month, first, count }: { month: string; first: boolean; count?: number }) {
  return (
    <div className="mb-[18px] flex items-baseline gap-3.5">
      <span className="flex-none text-[clamp(26px,3vw,36px)] font-medium tracking-[-0.03em] text-ink">{month}</span>
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
// chosen date range), EVENTS_PER_MONTH at a time, with its own "Load more". It waits until it's
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
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // This month's window, clamped to the list's range ("Upcoming" starts today, not on the 1st).
  const monthStart = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const from = query.from && query.from > monthStart ? query.from : monthStart;
  const to = query.to && query.to < monthEnd ? query.to : monthEnd;

  async function load(nextPage: number) {
    setLoading(true);
    setError(null);
    try {
      // After the first month, only events that start in this month: an event running across
      // several months is listed once, where it starts (the first month also keeps events
      // already running when the range begins).
      const result = await listEventsPage({
        ...query,
        from,
        to,
        startFrom: first ? undefined : monthStart,
        page: nextPage,
        pageSize: EVENTS_PER_MONTH,
      });
      setItems((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]));
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load events. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  // First page once the section is within a screen or so of the viewport. The parent remounts
  // every section when the filters change, so this runs once per section per filter set.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void load(1);
      },
      { rootMargin: '800px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one first load per mount
  }, []);

  if (total === 0) return null;

  const label = formatMonthYear(month);
  const remaining = total === null ? 0 : total - items.length;

  return (
    <section ref={sectionRef} aria-label={label} aria-busy={loading} className={first ? 'mt-5' : 'mt-[52px]'}>
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
          <Button variant="secondary" size="sm" onClick={() => void load(page + 1)}>
            Try again
          </Button>
        </div>
      ) : (
        remaining > 0 && (
          <div className="mt-6 flex justify-center">
            <Button size="sm" disabled={loading} onClick={() => void load(page + 1)}>
              {loading ? 'Loading…' : `Load more from ${label}`}
            </Button>
          </div>
        )
      )}
    </section>
  );
}
