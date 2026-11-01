'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  /**
   * Muted context line shown above the label, on its own line so a long hierarchy path (e.g.
   * "Tax › Direct Tax") never squeezes the label at phone widths. Also searched.
   */
  context?: string;
}

// Single-select dropdown with a search box, for lists too long for a native <select>. Each option
// is two lines (context over label), and the query matches across both — so typing a service
// name surfaces every category that offers it, side by side.
//
// Keyboard: ArrowDown/Enter/Space on the trigger opens it; typing filters; ArrowUp/ArrowDown move
// the highlight (focus stays in the search box); Enter picks; Escape closes and returns focus to
// the trigger; tabbing out closes it.
export function Combobox({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  error,
  markRequired,
  clearable = false,
}: {
  /** Lands on the trigger button, so scrollToFirstError can focus it. */
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  error?: string;
  markRequired?: boolean;
  /** Shows a ✕ on the trigger to empty an optional field. */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const labelId = `${triggerId}-label`;
  const listId = `${triggerId}-list`;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setActive(0);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = filterOptions(options, query);

  // Keep the highlighted row in view as it moves.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function close(returnFocus = true) {
    setOpen(false);
    setQuery('');
    setActive(0);
    if (returnFocus) triggerRef.current?.focus();
  }

  function pick(next: string) {
    onChange(next);
    close();
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = filtered[active];
      if (option) pick(option.value);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col gap-1.5"
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation(); // don't also close a surrounding modal
          close();
        }
      }}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) close(false);
      }}
    >
      <span id={labelId} className="text-xs font-medium text-ink-2">
        {label}
        {markRequired && (
          <span aria-hidden="true" className="text-error">
            {' '}
            *
          </span>
        )}
      </span>

      <div className="relative">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${labelId} ${triggerId}`}
          aria-describedby={error ? `${triggerId}-error` : undefined}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={onTriggerKeyDown}
          className={`flex min-h-[46px] w-full items-center rounded-input border bg-bg py-2 pl-3.5 text-left text-sm focus:outline-none focus:ring-[3px] ${
            clearable && selected ? 'pr-16' : 'pr-9'
          } ${
            error
              ? 'border-error focus:border-error focus:ring-error/[0.08]'
              : open
                ? 'border-ink ring-[3px] ring-ink/[0.08]'
                : 'border-line focus:border-ink focus:ring-ink/[0.08]'
          }`}
        >
          {selected ? (
            <span className="flex min-w-0 flex-col">
              {selected.context && <span className="truncate text-xs text-ink-3">{selected.context}</span>}
              <span className="truncate text-ink">{selected.label}</span>
            </span>
          ) : (
            <span className="text-ink">{placeholder}</span>
          )}
        </button>

        {clearable && selected && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              onChange('');
              triggerRef.current?.focus();
            }}
            className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs text-ink-4 hover:bg-bg-alt hover:text-ink"
          >
            ✕
          </button>
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-input border border-line bg-bg-card shadow-panel">
            <div className="border-b border-line p-2">
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                aria-label={`Search ${label}`}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                // 16px on phones stops iOS Safari zooming the page when the field gains focus.
                className="w-full rounded-input border border-line-2 px-3 py-2 text-base outline-none focus:border-ink sm:text-sm"
              />
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              className="max-h-[min(340px,50vh)] overflow-y-auto overscroll-contain py-1"
            >
              {filtered.length === 0 && <li className="px-3.5 py-3 text-sm text-ink-3">{emptyText}</li>}
              {filtered.map((option, i) => (
                <li
                  key={option.value}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={option.value === value}
                  // mousedown, not click: picks before the search box's blur would close the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(option.value);
                  }}
                  onMouseMove={() => setActive(i)}
                  className={`flex cursor-pointer items-start justify-between gap-3 px-3.5 py-2.5 ${
                    i === active ? 'bg-bg-alt' : ''
                  }`}
                >
                  <span className="flex min-w-0 flex-col">
                    {option.context && <span className="text-xs leading-4 text-ink-3">{option.context}</span>}
                    <span className="text-sm text-ink">{option.label}</span>
                  </span>
                  {option.value === value && (
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1 h-3.5 w-3.5 shrink-0 text-accent">
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <span id={`${triggerId}-error`} className="text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
}

// Each query word must be the start of some word in "context label", so "m&a tax" finds
// "M&A / Transaction Tax" but not "Fund & Investment Management Tax". "&" is kept as part of a word
// ("M & A" reads as "m&a"); a query word typed without one also matches with it dropped, so "ma"
// still finds "M&A".
function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\s*&\s*/g, '&')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const queryWords = words(query);
  if (queryWords.length === 0) return options;
  return options.filter((o) => {
    const optionWords = words(`${o.context ?? ''} ${o.label}`);
    return queryWords.every((q) =>
      optionWords.some((w) => w.startsWith(q) || (!q.includes('&') && w.replace(/&/g, '').startsWith(q)))
    );
  });
}
