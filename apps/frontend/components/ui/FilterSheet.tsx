'use client';

import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

// Phone filter sheet, shopping-site style: collapsible sections of options, a live result count on
// the apply button, and "Clear all". The parent owns the draft (what's ticked in the sheet) and
// only commits it to the page on apply. Desktop pages keep their FilterPopover dropdowns.
export function FilterSheet({
  onClose,
  onApply,
  onClear,
  canClear,
  count,
  noun,
  children,
}: {
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  canClear: boolean;
  /** Matches for the current draft; null while it loads (or when it can't be known). */
  count: number | null;
  /** Plural noun for the apply button: "Show 238 articles". */
  noun: { one: string; other: string };
  children: ReactNode;
}) {
  return (
    <BottomSheet
      title="Filters"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="flex-1" disabled={!canClear} onClick={onClear}>
            Clear all
          </Button>
          <Button className="flex-[2]" onClick={onApply}>
            {count === null
              ? `Show ${noun.other}`
              : count === 0
                ? `No ${noun.other}`
                : `Show ${count.toLocaleString('en-GB')} ${count === 1 ? noun.one : noun.other}`}
          </Button>
        </>
      }
    >
      {children}
    </BottomSheet>
  );
}

/** One collapsible section of the sheet, with a count badge of what's selected in it. */
export function FilterSheetSection({
  title,
  selected,
  defaultOpen = false,
  children,
}: {
  title: string;
  selected: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-line last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {selected > 0 && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-bg-card">{selected}</span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-ink-4 transition-transform group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-5 pb-4">{children}</div>
    </details>
  );
}

/** Checkbox list (or radio list with `single`) for a FilterSheetSection. */
export function FilterSheetOptions({
  options,
  selected,
  onToggle,
  single = false,
  name,
  scroll = false,
  emptyText,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  /** One choice only (radio buttons); `name` groups them. */
  single?: boolean;
  name?: string;
  /** Long lists scroll inside the section instead of stretching the sheet. */
  scroll?: boolean;
  emptyText?: string;
}) {
  if (options.length === 0) return <p className="py-2 text-sm text-ink-3">{emptyText}</p>;
  return (
    <ul className={`flex flex-col ${scroll ? 'max-h-60 overflow-y-auto overscroll-contain' : ''}`}>
      {options.map((o) => (
        <li key={o.value}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-2">
            <input
              type={single ? 'radio' : 'checkbox'}
              name={single ? name : undefined}
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
              className="h-[18px] w-[18px] flex-none accent-accent"
            />
            <span className="min-w-0">{o.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Search box above a long option list (countries, organisers) inside a FilterSheetSection. */
export function FilterSheetSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  /** e.g. "countries" -> "Search countries…" */
  label: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Search ${label}…`}
      aria-label={`Search ${label}`}
      className="mb-2 w-full rounded-input border border-line px-3.5 py-2.5 text-base outline-none focus:border-ink"
    />
  );
}
