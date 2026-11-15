'use client';

import { useEffect, useId, useRef, useState } from 'react';

const EARLIEST = 1950;
const PAGE = 12;

/**
 * A year chosen from a small calendar-style popover, like the events date picker: a field showing
 * the year opens a grid of twelve years, ‹ › page through the decades, a tap picks one. No typing,
 * so an impossible year can't be entered. `yearsAhead` allows that many future years.
 */
export function YearPicker({
  label,
  value,
  onChange,
  yearsAhead = 0,
  markRequired,
}: {
  label: string;
  value: number | undefined | null;
  onChange: (year: number | undefined) => void;
  yearsAhead?: number;
  markRequired?: boolean;
}) {
  const thisYear = new Date().getFullYear();
  const latest = thisYear + yearsAhead;
  // The last year shown on the current page; pages are twelve years, newest page first.
  const pageEndFor = (y: number | undefined | null) =>
    y ? latest - Math.floor((latest - Math.min(Math.max(y, EARLIEST), latest)) / PAGE) * PAGE : latest;

  const [open, setOpen] = useState(false);
  const [pageEnd, setPageEnd] = useState(() => pageEndFor(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle() {
    if (!open) setPageEnd(pageEndFor(value));
    setOpen((o) => !o);
  }
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  function pick(year: number | undefined) {
    onChange(year);
    close();
  }

  const years = Array.from({ length: PAGE }, (_, i) => pageEnd - PAGE + 1 + i);
  const canEarlier = pageEnd - PAGE >= EARLIEST;
  const canLater = pageEnd < latest;
  const nav =
    'flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-bg-alt hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col gap-1.5"
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <span className="text-xs font-medium text-ink-2">
        {label}
        {markRequired && (
          <span aria-hidden="true" className="text-error">
            {' '}
            *
          </span>
        )}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${value ?? 'not set'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={`flex w-full items-center gap-2 rounded-input border bg-bg px-3.5 py-3 text-left text-sm focus:outline-none focus:ring-[3px] ${
          open ? 'border-ink ring-[3px] ring-ink/[0.08]' : 'border-line focus:border-ink focus:ring-ink/[0.08]'
        }`}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="flex-none text-ink-4"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span className={`flex-1 ${value ? 'tabular-nums text-ink' : 'text-ink-4'}`}>{value || 'Select year'}</span>
        <span aria-hidden="true" className="text-ink-4">
          ▾
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[min(300px,calc(100vw-48px))] rounded-xl border border-line-2 bg-bg-card p-3 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.14),0_4px_12px_-4px_rgba(0,0,0,0.08)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Earlier years"
              disabled={!canEarlier}
              onClick={() => setPageEnd((e) => e - PAGE)}
              className={nav}
            >
              ‹
            </button>
            <span className="text-sm font-semibold tabular-nums text-ink" aria-live="polite">
              {years[0]} – {years[PAGE - 1]}
            </span>
            <button
              type="button"
              aria-label="Later years"
              disabled={!canLater}
              onClick={() => setPageEnd((e) => Math.min(latest, e + PAGE))}
              className={nav}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {years.map((y) => {
              const disabled = y < EARLIEST || y > latest;
              const selected = y === value;
              return (
                <button
                  key={y}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => pick(y)}
                  className={`h-10 rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 ${
                    selected
                      ? 'bg-accent font-semibold text-bg-card'
                      : `hover:bg-bg-alt ${y === thisYear ? 'font-semibold text-accent ring-1 ring-accent/40' : 'text-ink-2'}`
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
          {!markRequired && value && (
            <div className="mt-2 flex justify-end border-t border-line pt-2">
              <button
                type="button"
                onClick={() => pick(undefined)}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
