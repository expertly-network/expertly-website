'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SignInLink } from '@/components/auth/SignInLink';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import type { EventDto } from '@shared/event';

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

type CalEvent = {
  id: string;
  title: string;
  cc: string;
  sd: Date;
  ed: Date;
  isPast: boolean;
};

// Bars shown per week row; any further events on a day collapse into a "+N more" line.
const MAX_LANES = 2;

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// An interactive month-calendar grid. Event pills aren't links — there's no event detail page
// yet — so the single "All events" CTA links to /events instead.
export function EventsCalendar({ events }: { events: EventDto[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = useMemo(() => startOfDay(new Date()), []);
  const base = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const yr = view.getFullYear();
  const mo = view.getMonth();

  const calEvents: CalEvent[] = useMemo(
    () =>
      events.map((e) => {
        const sd = startOfDay(new Date(e.startDate));
        const ed = e.endDate ? startOfDay(new Date(e.endDate)) : sd;
        return { id: e.id, title: e.title, cc: countryCode(e.country), sd, ed, isPast: ed < today };
      }),
    [events, today]
  );

  const firstDOW = new Date(yr, mo, 1).getDay();
  const startOffset = firstDOW === 0 ? 6 : firstDOW - 1;
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const totalWeeks = Math.ceil((startOffset + daysInMonth) / 7);

  const weeks = Array.from({ length: totalWeeks }, (_, w) => {
    const weekStart = w * 7 - startOffset + 1;
    const days = Array.from({ length: 7 }, (_, d) => {
      const dn = weekStart + d;
      if (dn < 1 || dn > daysInMonth) return null;
      const cDate = new Date(yr, mo, dn);
      return {
        dn,
        isToday: cDate.getTime() === today.getTime(),
        isPast: cDate < today,
        isWeekend: d >= 5,
      };
    });

    const weekEnd = weekStart + 6;
    const weekEvs = calEvents
      .filter((ev) => {
        const overlapsMonth =
          (ev.sd.getFullYear() === yr && ev.sd.getMonth() === mo) ||
          (ev.ed.getFullYear() === yr && ev.ed.getMonth() === mo);
        if (!overlapsMonth) return false;
        const esd = ev.sd.getDate();
        const eed = ev.ed.getDate();
        if (esd > Math.min(daysInMonth, weekEnd)) return false;
        if (eed < Math.max(1, weekStart)) return false;
        return true;
      })
      .map((ev) => {
        const ds = Math.max(ev.sd.getDate(), Math.max(1, weekStart));
        const de = Math.min(ev.ed.getDate(), Math.min(daysInMonth, weekEnd));
        return { ev, col: ds - weekStart + 1, span: de - ds + 1 };
      })
      // Earliest first, longer spans first on ties, so multi-day bars claim the top lanes.
      .sort((a, b) => a.col - b.col || b.span - a.span);

    // First-fit lane packing: each bar takes the first lane that's free from its start column.
    const laneEnds: number[] = [];
    const placed = weekEvs.map((item) => {
      let lane = laneEnds.findIndex((end) => end < item.col);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.col + item.span - 1;
      return { ...item, lane };
    });
    const visibleEvs = placed.filter((p) => p.lane < MAX_LANES);
    // Per weekday column (1-7): events on that day that didn't get a visible lane.
    const hiddenByCol = Array.from({ length: 7 }, (_, i) =>
      placed.filter((p) => p.lane >= MAX_LANES && p.col <= i + 1 && i + 1 < p.col + p.span)
    );

    return { days, weekEvs, visibleEvs, hiddenByCol };
  });

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
              <div key={wi} className="relative h-[112px] border-b border-line last:border-none">
                <div className="absolute inset-0 grid grid-cols-7">
                  {week.days.map((day, di) =>
                    day ? (
                      <div
                        key={di}
                        className={`h-full p-2 ${day.isPast ? 'opacity-30' : ''} ${day.isToday ? 'bg-[color-mix(in_oklab,var(--accent)_13%,var(--bg-card))]' : ''}`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center font-mono text-xs font-semibold tracking-[-0.01em] ${
                            day.isToday
                              ? 'rounded-full bg-accent font-bold text-bg'
                              : day.isPast
                                ? 'text-ink-4'
                                : 'text-ink-3'
                          }`}
                        >
                          {day.dn}
                        </span>
                      </div>
                    ) : (
                      <div key={di} className="h-full opacity-35" />
                    )
                  )}
                </div>
                {week.weekEvs.length > 0 && (
                  <div
                    className="absolute inset-0 grid grid-cols-7 content-start gap-x-1 gap-y-[3px] overflow-hidden px-[5px] pb-[5px] pt-8"
                    style={{ gridTemplateRows: '26px 26px 16px' }}
                  >
                    {week.visibleEvs.map(({ ev, col, span, lane }) => {
                      const content = (
                        <>
                          {ev.cc && (
                            <span
                              className={`flex-none font-mono text-[8px] font-extrabold ${ev.isPast ? 'text-ink-3' : 'text-accent'}`}
                            >
                              {ev.cc}
                            </span>
                          )}
                          <span
                            className={`flex-1 truncate text-xs font-semibold tracking-[-0.01em] ${ev.isPast ? 'text-ink-4' : 'text-ink'}`}
                          >
                            {ev.title}
                          </span>
                        </>
                      );
                      const style = { gridColumn: `${col} / span ${span}`, gridRow: lane + 1 };
                      // Past events are context only — no click affordance. Upcoming ones jump to
                      // their row on /events (there are no per-event pages yet).
                      return ev.isPast ? (
                        <span
                          key={ev.id}
                          title={ev.title}
                          className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border-l-[3px] border-ink-4 bg-[color-mix(in_oklab,var(--ink-4)_10%,var(--bg))] px-2.5 text-left opacity-45"
                          style={style}
                        >
                          {content}
                        </span>
                      ) : (
                        // A plain <a>, not <Link>: client-side navigation doesn't update the
                        // CSS :target state that highlights the row on /events.
                        <a
                          key={ev.id}
                          href={`/events#event-${ev.id}`}
                          title={ev.title}
                          className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border-l-[3px] border-accent bg-[linear-gradient(90deg,color-mix(in_oklab,var(--accent)_20%,var(--bg-card))_0%,color-mix(in_oklab,var(--accent)_8%,var(--bg-card))_100%)] px-2.5 text-left transition-all hover:-translate-y-px hover:shadow-[0_3px_18px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
                          style={style}
                        >
                          {content}
                        </a>
                      );
                    })}
                    {week.hiddenByCol.map((hidden, i) => {
                      if (hidden.length === 0) return null;
                      const day = week.days[i];
                      const label = `+${hidden.length} more`;
                      const names = hidden.map((h) => h.ev.title).join('\n');
                      const style = { gridColumn: `${i + 1}`, gridRow: MAX_LANES + 1 };
                      const cls = 'self-center truncate px-1 text-[11px] font-semibold leading-none';
                      return day?.isPast ? (
                        <span key={`more-${i}`} title={names} className={`${cls} text-ink-4`} style={style}>
                          {label}
                        </span>
                      ) : (
                        <Link
                          key={`more-${i}`}
                          href="/events"
                          title={names}
                          className={`${cls} text-accent hover:underline`}
                          style={style}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
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
              <span className="font-mono text-[9px] font-bold text-accent">Stay informed</span>
              <h3 className="text-[21px] font-semibold leading-tight tracking-[-0.02em] text-bg-card">
                Discover the right event for you, and make the best out of it.
              </h3>
              <p className="text-[13px] leading-relaxed text-white/50">
                This is a curated list of all the leading networking events hosted across the industry. Join GrowXQ, to
                discover the who, when, where and connect with the right network.
              </p>
              <SignInLink className="mt-1.5 inline-flex w-fit items-center rounded-lg bg-bg-card px-[18px] py-[11px] font-mono text-xs font-bold text-ink transition-colors hover:bg-accent-2">
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
        <UpcomingEvents events={events} />
      </div>
    </div>
  );
}
