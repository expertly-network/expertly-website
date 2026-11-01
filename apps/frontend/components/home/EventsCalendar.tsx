'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SignInLink } from '@/components/auth/SignInLink';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import type { CalendarEventDto, EventCalendarDay, EventCalendarResponse, EventDto } from '@shared/event';
import { isOnlineEvent, normalizeEventTitle } from '@/lib/events/format';
import { getEventCalendar } from '@/lib/api/events';
import { toIsoDate } from '@/lib/api/events-query';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const COUNTRY_CODE: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'UK',
  'South Korea': 'KR',
  India: 'IN',
  Netherlands: 'NL',
  Singapore: 'SG',
  'United Arab Emirates': 'AE',
  Switzerland: 'CH',
  'Hong Kong': 'HK',
  Belgium: 'BE',
  Germany: 'DE',
  Spain: 'ES',
  France: 'FR',
  'Cayman Islands': 'KY',
  Egypt: 'EG',
  Canada: 'CA',
};

function countryCode(name: string | null): string {
  if (!name) return '';
  return COUNTRY_CODE[name] ?? name.slice(0, 2).toUpperCase();
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// An interactive month grid. Each day shows up to two events and "+N more" for the rest — the API
// sends only that much per day (GET /v1/events/calendar), so switching months stays light.
// Past days and their events are greyed out; upcoming events link to their row on /events.
export function EventsCalendar({ calendar, upcoming }: { calendar: EventCalendarResponse; upcoming: EventDto[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = useMemo(() => startOfDay(new Date()), []);
  const base = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const yr = view.getFullYear();
  const mo = view.getMonth();

  // Calendar days per month, fetched as the visitor navigates (the server renders the current
  // month). `null` = that month failed to load.
  const [byMonth, setByMonth] = useState<Record<string, EventCalendarDay[] | null>>(() => ({
    [`${base.getFullYear()}-${base.getMonth()}`]: calendar.days,
  }));
  const monthKey = `${yr}-${mo}`;
  const monthDays = byMonth[monthKey];
  const monthLoading = monthDays === undefined;

  useEffect(() => {
    if (byMonth[monthKey] !== undefined) return;
    let cancelled = false;
    getEventCalendar(toIsoDate(new Date(yr, mo, 1)), toIsoDate(new Date(yr, mo + 1, 0)))
      .then(({ days }) => !cancelled && setByMonth((prev) => ({ ...prev, [monthKey]: days })))
      .catch(() => !cancelled && setByMonth((prev) => ({ ...prev, [monthKey]: null })));
    return () => {
      cancelled = true;
    };
  }, [byMonth, monthKey, yr, mo]);

  const dayByDate = useMemo(() => new Map((monthDays ?? []).map((d) => [d.date, d])), [monthDays]);

  const firstDOW = new Date(yr, mo, 1).getDay();
  const startOffset = firstDOW === 0 ? 6 : firstDOW - 1;
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const totalWeeks = Math.ceil((startOffset + daysInMonth) / 7);

  const weeks = Array.from({ length: totalWeeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dn = w * 7 - startOffset + 1 + d;
      if (dn < 1 || dn > daysInMonth) return null;
      const cDate = new Date(yr, mo, dn);
      return {
        dn,
        isToday: cDate.getTime() === today.getTime(),
        isPast: cDate < today,
        data: dayByDate.get(toIsoDate(cDate)),
      };
    })
  );

  const label = (ev: CalendarEventDto) => (isOnlineEvent(ev) ? 'Online' : countryCode(ev.country));

  return (
    <div>
      <div className="hidden min-[860px]:block">
        <div className="flex items-center gap-3 pb-4">
          <button
            type="button"
            onClick={() => setMonthOffset((v) => v - 1)}
            aria-label="Previous month"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line-2 bg-bg-card text-ink-3 transition-colors hover:border-ink hover:text-ink"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          {/* Fixed width (fits "September 2026") so the next arrow doesn't shift month to month. */}
          <span className="w-[116px] text-center font-mono text-[13px] font-semibold text-ink-3">
            {MONTH_NAMES[mo]} {yr}
          </span>
          <button
            type="button"
            onClick={() => setMonthOffset((v) => v + 1)}
            aria-label="Next month"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line-2 bg-bg-card text-ink-3 transition-colors hover:border-ink hover:text-ink"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <span className="text-xs text-ink-3" aria-live="polite">
            {monthLoading
              ? 'Loading events…'
              : monthDays === null
                ? "Couldn't load this month's events."
                : monthDays.length === 0
                  ? 'No events listed this month yet.'
                  : ''}
          </span>
        </div>

        {/* The side panel sits beside the month grid only from lg up; between 860px and lg it stacks
            below, so the 7 day columns keep their full width. Below 860px the grid is swapped for
            the stacked UpcomingEvents list (7 columns can't fit event names at phone widths). */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1fr_296px]">
          <div className="min-w-0 overflow-hidden">
            <div className="grid grid-cols-7 border-b-2 border-ink-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-2.5 pb-3.5 text-center font-mono text-[10px] font-bold text-ink-2">
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid h-[112px] grid-cols-7 border-b border-line last:border-none">
                {week.map((day, di) =>
                  day ? (
                    <div
                      key={di}
                      className={`flex min-w-0 flex-col gap-[3px] p-1.5 ${day.isToday ? 'bg-[color-mix(in_oklab,var(--accent)_13%,var(--bg-card))]' : ''}`}
                    >
                      <span
                        className={`mb-0.5 inline-flex h-6 w-6 flex-none items-center justify-center font-mono text-xs font-semibold tracking-[-0.01em] ${
                          day.isToday
                            ? 'rounded-full bg-accent font-bold text-bg'
                            : day.isPast
                              ? 'text-ink-4 opacity-50'
                              : 'text-ink-3'
                        }`}
                      >
                        {day.dn}
                      </span>
                      {day.data?.events.map((ev) => {
                        const title = normalizeEventTitle(ev.title);
                        const content = (
                          <>
                            <span
                              className={`flex-none font-mono text-[8px] font-extrabold ${day.isPast ? 'text-ink-4' : 'text-accent'}`}
                            >
                              {label(ev)}
                            </span>
                            <span
                              className={`flex-1 truncate text-[11px] font-semibold tracking-[-0.01em] ${day.isPast ? 'text-ink-3' : 'text-ink'}`}
                            >
                              {title}
                            </span>
                          </>
                        );
                        const cls =
                          'flex h-[22px] min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-md border-l-[3px] px-1.5 text-left';
                        // Past events stay visible (greyed) but aren't links; upcoming ones jump to their
                        // row on /events. A plain <a> so the row's CSS :target highlight applies.
                        return day.isPast ? (
                          <span key={ev.id} title={title} className={`${cls} cursor-default border-line-2 bg-bg-alt`}>
                            {content}
                          </span>
                        ) : (
                          <a
                            key={ev.id}
                            href={`/events#event-${ev.id}`}
                            title={title}
                            className={`${cls} border-accent bg-[color-mix(in_oklab,var(--accent)_14%,var(--bg-card))] transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_24%,var(--bg-card))]`}
                          >
                            {content}
                          </a>
                        );
                      })}
                      {day.data && day.data.count > day.data.events.length && (
                        <Link
                          href="/events"
                          className={`truncate px-1 text-[11px] font-semibold leading-tight hover:underline ${day.isPast ? 'text-ink-4' : 'text-accent'}`}
                        >
                          +{day.data.count - day.data.events.length} more
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div key={di} />
                  )
                )}
              </div>
            ))}
          </div>

          <aside className="relative flex flex-col overflow-hidden rounded-2xl bg-ink">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
              style={{ background: 'color-mix(in oklab, var(--accent) 18%, transparent)' }}
            />
            <div className="relative z-[1] flex flex-1 flex-col justify-center gap-4 p-7">
              <span className="font-mono text-[9px] font-semibold text-accent">Stay informed</span>
              <h3 className="text-[21px] font-medium leading-tight tracking-[-0.02em] text-bg-card">
                Discover the right event for you, and make the best out of it.
              </h3>
              <p className="text-[13px] leading-relaxed text-white/50">
                This is a curated list of all the leading networking events hosted across the industry. Join GrowXQ, to
                discover the who, when, where and connect with the right network.
              </p>
              <SignInLink className="mt-1.5 inline-flex w-fit items-center rounded-lg bg-bg-card px-[18px] py-[11px] font-mono text-xs font-semibold text-ink transition-colors hover:bg-accent-2">
                Join for free →
              </SignInLink>
              <Link
                href="/events"
                className="w-fit font-mono text-xs font-medium text-white/35 transition-colors hover:text-white/65"
              >
                Browse all events
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <div className="min-[860px]:hidden">
        <UpcomingEvents events={upcoming} />
      </div>
    </div>
  );
}
