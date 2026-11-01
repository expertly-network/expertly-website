'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { formatDate, formatDayMonth, formatMonthYear } from '@/lib/dates';

/** Inclusive day range at local midnight; `null` leaves that side open. */
export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePreset {
  label: string;
  range: () => DateRange;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getTime() === b.getTime();
}

function sameRange(a: DateRange, b: DateRange): boolean {
  return (
    (a.from?.getTime() ?? null) === (b.from?.getTime() ?? null) &&
    (a.to?.getTime() ?? null) === (b.to?.getTime() ?? null)
  );
}

// Monday-first grid of a month: leading nulls pad the first week.
function monthCells(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
}

function rangeLabel(range: DateRange, presets: DateRangePreset[], placeholder: string): string {
  const preset = presets.find((p) => sameRange(p.range(), range));
  if (preset) return preset.label;
  const { from, to } = range;
  if (from && to) {
    if (sameDay(from, to)) return formatDate(from);
    return from.getFullYear() === to.getFullYear()
      ? `${formatDayMonth(from)} – ${formatDate(to)}`
      : `${formatDate(from)} – ${formatDate(to)}`;
  }
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Until ${formatDate(to)}`;
  return placeholder;
}

/**
 * A from–to date picker in the hotel check-in style: a two-month calendar (one month on phones)
 * where the first click picks the start, the second the end, with the range previewed on hover.
 * Quick presets sit alongside. Styled to match FilterPopover's trigger so it sits in a filter row.
 */
export function DateRangePicker({
  value,
  onChange,
  presets = [],
  prefix,
  placeholder = 'Any dates',
  hasEvent,
  clearValue = { from: null, to: null },
  onVisibleMonthsChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: DateRangePreset[];
  /** Muted lead-in on the trigger, e.g. "When:". */
  prefix?: string;
  placeholder?: string;
  /** Marks days with something on them with a dot (the design's "· indicates events on that date"). */
  hasEvent?: (day: Date) => boolean;
  /** What "Clear" resets to — e.g. the list's default "Upcoming" range rather than all dates. */
  clearValue?: DateRange;
  /** Called with the first and last day on screen while open — e.g. to load `hasEvent` data. */
  onVisibleMonthsChange?: (first: Date, last: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  // The range being picked: a start without an end means "now pick the end date".
  const [pending, setPending] = useState<DateRange>(value);
  const [hover, setHover] = useState<Date | null>(null);
  const [month, setMonth] = useState(() => addMonths(value.from ?? startOfDay(new Date()), 0));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const today = startOfDay(new Date());

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // While open, report the two months on screen (first day of the first to last day of the second).
  useEffect(() => {
    if (!open || !onVisibleMonthsChange) return;
    onVisibleMonthsChange(month, new Date(month.getFullYear(), month.getMonth() + 2, 0));
  }, [open, month, onVisibleMonthsChange]);

  function openPanel() {
    // A complete from–to range opens as-is, ready to be re-picked. An open-ended one (e.g. the
    // default "Upcoming" = from today) starts blank: otherwise its implied start would turn the
    // first click into the end date, and the start could never be chosen.
    setPending(value.from && value.to ? value : { from: null, to: null });
    setHover(null);
    setMonth(addMonths(value.from ?? today, 0));
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    setHover(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  function commit(range: DateRange) {
    onChange(range);
    close();
  }

  function pickDay(day: Date) {
    // No start yet, or a full range already chosen: this click starts a new range.
    if (!pending.from || pending.to) {
      setPending({ from: day, to: null });
      return;
    }
    // A day before the chosen start moves the start instead of making a backwards range.
    if (day < pending.from) {
      setPending({ from: day, to: null });
      return;
    }
    commit({ from: pending.from, to: day });
  }

  // While choosing the end date, the hovered day previews the range.
  const previewTo = pending.from && !pending.to && hover && hover >= pending.from ? hover : pending.to;

  function dayState(day: Date) {
    const from = pending.from;
    const to = previewTo;
    const isStart = sameDay(day, from);
    const isEnd = sameDay(day, to);
    const inRange = !!from && !!to && day > from && day < to;
    return { isStart, isEnd, inRange, isToday: sameDay(day, today) };
  }

  const isCleared = sameRange(value, clearValue);
  const months = [month, addMonths(month, 1)];
  const label = rangeLabel(value, presets, placeholder);
  const hint = pending.from && !pending.to ? 'Now choose an end date' : 'Choose a start date';

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <div
        className={`inline-flex items-center gap-2 rounded-input border px-4 py-2.5 text-sm font-medium transition-colors ${
          open
            ? 'border-accent bg-bg-card text-ink shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_14%,transparent)]'
            : isCleared
              ? 'border-line-2 bg-bg-card text-ink-2 hover:border-ink'
              : 'border-ink bg-bg-card text-ink'
        }`}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => (open ? close(false) : openPanel())}
          className="inline-flex items-center gap-2"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-4"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <span>
            {prefix && <span className="mr-1 font-normal text-ink-4">{prefix}</span>}
            {label}
          </span>
          <span className="text-ink-4">▾</span>
        </button>
        {!isCleared && (
          <button
            type="button"
            aria-label="Clear date range"
            onClick={() => onChange(clearValue)}
            className="ml-1 text-ink-4 hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose dates"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[min(680px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line-2 bg-bg-card shadow-[0_16px_48px_-8px_rgba(0,0,0,0.14),0_4px_12px_-4px_rgba(0,0,0,0.08)]"
        >
          <div className="flex flex-col sm:flex-row">
            {presets.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto border-b border-line p-2 sm:w-40 sm:flex-none sm:flex-col sm:border-b-0 sm:border-r">
                {presets.map((p) => {
                  const active = sameRange(p.range(), value);
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => commit(p.range())}
                      className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        active ? 'bg-accent/10 font-semibold text-accent' : 'text-ink-2 hover:bg-bg-alt'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="min-w-0 flex-1 p-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonth((m) => addMonths(m, -1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-bg-alt hover:text-ink"
                >
                  ‹
                </button>
                <span className="text-xs text-ink-3" aria-live="polite">
                  {hint}
                </span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-bg-alt hover:text-ink"
                >
                  ›
                </button>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {months.map((m, mi) => (
                  // Phones show one month; the second appears from `sm` up.
                  <div key={m.toISOString()} className={mi === 1 ? 'hidden sm:block' : ''}>
                    <div className="mb-2 text-center text-sm font-semibold text-ink">{formatMonthYear(m)}</div>
                    <div className="grid grid-cols-7 text-center text-[11px] text-ink-4">
                      {WEEKDAYS.map((d) => (
                        <div key={d} className="pb-1.5">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
                      {monthCells(m).map((day, di) => {
                        if (!day) return <div key={`pad-${di}`} />;
                        const { isStart, isEnd, inRange, isToday } = dayState(day);
                        const endpoint = isStart || isEnd;
                        // The band behind the circle joins the days of the range into one strip.
                        const band = inRange
                          ? 'bg-accent/10'
                          : isStart && previewTo && !sameDay(pending.from, previewTo)
                            ? 'bg-[linear-gradient(90deg,transparent_50%,color-mix(in_oklab,var(--accent)_10%,transparent)_50%)]'
                            : isEnd && pending.from && !sameDay(pending.from, previewTo)
                              ? 'bg-[linear-gradient(90deg,color-mix(in_oklab,var(--accent)_10%,transparent)_50%,transparent_50%)]'
                              : '';
                        return (
                          <div key={day.toISOString()} className={`py-0.5 ${band}`}>
                            <button
                              type="button"
                              aria-label={formatDate(day)}
                              aria-pressed={endpoint}
                              onClick={() => pickDay(day)}
                              onMouseEnter={() => setHover(day)}
                              onFocus={() => setHover(day)}
                              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                endpoint
                                  ? 'bg-accent font-semibold text-bg-card'
                                  : `${inRange ? 'text-ink' : 'text-ink-2'} hover:bg-bg-alt ${isToday ? 'font-semibold text-accent ring-1 ring-accent/40' : ''}`
                              }`}
                            >
                              <span className="relative">
                                {day.getDate()}
                                {hasEvent?.(day) && (
                                  <span
                                    aria-hidden="true"
                                    className={`absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${endpoint ? 'bg-bg-card' : 'bg-accent'}`}
                                  />
                                )}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-xs text-ink-3">
                  {pending.from ? formatDate(pending.from) : 'Start date'} –{' '}
                  {pending.to ? formatDate(pending.to) : 'End date'}
                  {hasEvent && <span className="ml-3 hidden text-ink-4 sm:inline">· marks days with events</span>}
                </span>
                <button
                  type="button"
                  onClick={() => commit(clearValue)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
