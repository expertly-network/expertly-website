'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface FilterPopoverOption {
  value: string;
  label: string;
}

// A checkbox/radio popover supporting multi-select and in-list search.
//
// Keyboard: ArrowDown/Enter/Space on the trigger opens it; ArrowUp/ArrowDown move through the
// options (from the search box too); Space toggles the highlighted option; Enter applies —
// in single-select it picks the highlighted option, in multi-select it closes the list with the
// current selection; Escape closes without further changes and returns focus to the trigger;
// tabbing out closes it.
export function FilterPopover({
  label,
  options,
  selected,
  onChange,
  multi = true,
  searchable = true,
  footer,
  fullWidth = false,
  prefix,
  clearable = true,
}: {
  label: string;
  options: FilterPopoverOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  multi?: boolean;
  searchable?: boolean;
  /** Extra content rendered below the option list, separated by a divider. */
  footer?: ReactNode;
  /** Stretches the trigger to fill its container, like a form field. */
  fullWidth?: boolean;
  /** Muted lead-in on the trigger, e.g. "Sort:" — marks a control that orders/scopes rather than filters. */
  prefix?: string;
  /**
   * False for controls that always have a value (sort order, date scope): no ✕, and no "active
   * filter" fill — so they don't read as a removable filter.
   */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLabelElement | null)[]>([]);
  const listId = useId();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const triggerLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${label} (${selected.length})`;

  // Without a search box there's nothing to autofocus, so opening lands on the first option.
  useEffect(() => {
    if (open && !searchable) {
      setActive(0);
      optionRefs.current[0]?.focus();
    }
  }, [open, searchable]);

  function close(returnFocus = true) {
    setOpen(false);
    setActive(-1);
    setQuery('');
    if (returnFocus) triggerRef.current?.focus();
  }

  function openList() {
    setOpen(true);
    setActive(-1);
  }

  // Moves the highlight and real focus together, so Space/Enter land on the right row and the
  // list scrolls with it. Index -1 means "back in the search box".
  function moveTo(index: number) {
    if (index < 0) {
      setActive(-1);
      searchRef.current?.focus();
      return;
    }
    const clamped = Math.min(index, filtered.length - 1);
    setActive(clamped);
    optionRefs.current[clamped]?.focus();
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openList();
    } else if (open && e.key === 'ArrowDown') {
      e.preventDefault();
      moveTo(0);
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) moveTo(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // A single match is the obvious intent; otherwise Enter just applies what's ticked.
      if (filtered.length === 1 && (!multi || !selected.includes(filtered[0].value))) toggle(filtered[0].value);
      if (multi || filtered.length !== 1) close();
    }
  }

  function onOptionKeyDown(e: KeyboardEvent<HTMLLabelElement>, index: number, value: string) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveTo(Math.min(index + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveTo(index - 1 < 0 && !searchable ? 0 : index - 1);
        break;
      case 'Home':
        e.preventDefault();
        moveTo(0);
        break;
      case 'End':
        e.preventDefault();
        moveTo(filtered.length - 1);
        break;
      case ' ':
        e.preventDefault();
        toggle(value);
        break;
      case 'Enter':
        e.preventDefault();
        if (multi) close();
        else toggle(value);
        break;
    }
  }

  function toggle(value: string) {
    if (multi) {
      onChange(
        selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
      );
    } else {
      onChange([value]);
      close();
    }
  }

  return (
    <div
      className={`relative ${fullWidth ? 'w-full' : ''}`}
      ref={rootRef}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation(); // don't also close a surrounding modal
          close();
        }
      }}
      onBlur={(e) => {
        // Focus left the whole widget (e.g. Tab past the last control) -> close quietly.
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) close(false);
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-input border text-sm font-medium transition-colors ${
          fullWidth ? 'w-full justify-between px-3.5 py-3' : 'inline-flex px-4 py-2.5'
        } ${
          open
            ? // Explicit bg/text: on a dark section (e.g. the newsletter banner) the inherited
              // text color made the label vanish while open.
              'border-accent bg-bg-card text-ink shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_14%,transparent)]'
            : clearable && selected.length > 0
              ? 'border-ink bg-bg-card text-ink'
              : `border-line-2 bg-bg-card hover:border-ink ${fullWidth ? 'text-ink-4' : 'text-ink-2'}`
        }`}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onTriggerKeyDown}
          className={`inline-flex items-center gap-2 ${fullWidth ? 'w-full justify-between' : ''}`}
        >
          <span>
            {prefix && <span className="mr-1 font-normal text-ink-4">{prefix}</span>}
            {triggerLabel}
          </span>
          <span className="text-ink-4">▾</span>
        </button>
        {clearable && selected.length > 0 && (
          <button
            type="button"
            aria-label={`Clear ${label} filter`}
            onClick={() => onChange([])}
            className="ml-1 text-ink-4 hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-80 overflow-hidden rounded-xl border border-line-2 bg-bg-card shadow-[0_16px_48px_-8px_rgba(0,0,0,0.14),0_4px_12px_-4px_rgba(0,0,0,0.08)] ${fullWidth ? '' : 'w-64'}`}
        >
          {searchable && (
            <div className="border-b border-line p-2">
              <input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(-1);
                }}
                onKeyDown={onSearchKeyDown}
                aria-controls={listId}
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-ink"
              />
            </div>
          )}
          <div
            id={listId}
            role="listbox"
            aria-multiselectable={multi || undefined}
            aria-label={label}
            className="max-h-64 overflow-y-auto p-1.5"
          >
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-sm text-ink-3">No matches</div>
            )}
            {filtered.map((option, i) => (
              <label
                key={option.value}
                id={`${listId}-${i}`}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                role="option"
                aria-selected={selected.includes(option.value)}
                tabIndex={-1}
                onKeyDown={(e) => onOptionKeyDown(e, i, option.value)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink outline-none hover:bg-bg-alt ${
                  active === i ? 'bg-bg-alt' : ''
                }`}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  tabIndex={-1}
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4"
                />
                {option.label}
              </label>
            ))}
          </div>
          {footer && <div className="border-t border-line p-1.5">{footer}</div>}
        </div>
      )}
    </div>
  );
}
