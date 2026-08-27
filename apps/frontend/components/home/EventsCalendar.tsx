'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import type { EventDto } from '@shared/event';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COUNTRY_CODE: Record<string, string> = {
  'United States': 'US', 'United Kingdom': 'UK', 'South Korea': 'KR', India: 'IN',
  Netherlands: 'NL', Singapore: 'SG', 'United Arab Emirates': 'AE', Switzerland: 'CH',
  'Hong Kong': 'HK', Belgium: 'BE', Germany: 'DE', Spain: 'ES', France: 'FR',
  'Cayman Islands': 'KY', Egypt: 'EG', Canada: 'CA',
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

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// Full interactive month-calendar grid — matches design/static_html/index.html's
// `.home-calendar` (`#hcal-*` inline script) faithfully: Monday-start week grid, today/past/
// weekend cell states, event pills spanning their date range via CSS grid columns, month
// navigation. Reimplemented as React state instead of DOM manipulation; the custom
// fixed-position hover tooltip is simplified to a native `title` attribute (same practical
// result, far less code). Event pills aren't links — there's no `/events/[slug]` detail page
// yet, so 30+ individual dead links would be worse than a title-only pill; the single "All
// events" CTA does link to `/events` (task #6, not yet built, same precedent as this page's
// "View all" articles link).
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
      });

    return { days, weekEvs };
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span className="font-mono text-[13px] font-semibold tracking-[0.1em] text-ink-3">
            {MONTH_NAMES[mo]} {yr}
          </span>
          <button
            type="button"
            onClick={() => setMonthOffset((v) => v + 1)}
            aria-label="Next month"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line-2 bg-bg-card text-ink-3 transition-colors hover:border-ink hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-[1fr_296px] items-stretch gap-6">
          <div className="min-w-0 overflow-hidden">
            <div className="grid grid-cols-7 border-b-2 border-ink-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div
                  key={d}
                  className="py-2.5 pb-3.5 text-center font-mono text-[10px] font-bold tracking-[0.14em] text-ink-2"
                >
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="relative h-[100px] border-b border-line last:border-none">
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
                    style={{ gridAutoRows: '26px' }}
                  >
                    {week.weekEvs.map(({ ev, col, span }) => (
                      <button
                        key={ev.id}
                        type="button"
                        title={ev.title}
                        className={`flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border-l-[3px] px-2.5 text-left transition-all ${
                          ev.isPast
                            ? 'border-ink-4 bg-[color-mix(in_oklab,var(--ink-4)_10%,var(--bg))] opacity-45'
                            : 'border-accent bg-[linear-gradient(90deg,color-mix(in_oklab,var(--accent)_20%,var(--bg-card))_0%,color-mix(in_oklab,var(--accent)_8%,var(--bg-card))_100%)] hover:shadow-[0_3px_18px_color-mix(in_oklab,var(--accent)_30%,transparent)] hover:-translate-y-px'
                        }`}
                        style={{ gridColumn: `${col} / span ${span}` }}
                      >
                        {ev.cc && (
                          <span
                            className={`flex-none font-mono text-[8px] font-extrabold tracking-[0.1em] ${ev.isPast ? 'text-ink-3' : 'text-accent'}`}
                          >
                            {ev.cc}
                          </span>
                        )}
                        <span
                          className={`flex-1 truncate text-xs font-semibold tracking-[-0.01em] ${ev.isPast ? 'text-ink-4' : 'text-ink'}`}
                        >
                          {ev.title}
                        </span>
                      </button>
                    ))}
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
              <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-accent">
                Stay informed
              </span>
              <h3 className="text-[21px] font-semibold leading-tight tracking-[-0.02em] text-bg-card">
                Discover the right event for you, and make the best out of it.
              </h3>
              <p className="text-[13px] leading-relaxed text-white/50">
                This is a curated list of all the leading networking events hosted across the
                industry. Join Expertly, to discover the who, when, where and connect with the
                right network.
              </p>
              <Link
                href="/login"
                className="mt-1.5 inline-flex w-fit items-center rounded-lg bg-bg-card px-[18px] py-[11px] font-mono text-xs font-bold tracking-[0.02em] text-ink transition-colors hover:bg-accent-2"
              >
                Join for free →
              </Link>
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
