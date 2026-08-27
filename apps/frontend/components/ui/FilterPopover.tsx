'use client';

import { useEffect, useRef, useState } from 'react';

export interface FilterPopoverOption {
  value: string;
  label: string;
}

// A checkbox/radio popover for filter controls that need multi-select
// and/or in-list search — native <select> (see Select.tsx) can't do either.
// New base primitive because the directory's practice/country/rate/sort
// filters all need this shape; documented in docs/design-system.md (Task 20).
export function FilterPopover({
  label,
  options,
  selected,
  onChange,
  multi = true,
  searchable = true,
}: {
  label: string;
  options: FilterPopoverOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  multi?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

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

  function toggle(value: string) {
    if (multi) {
      onChange(
        selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
      );
    } else {
      onChange([value]);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <div
        className={`inline-flex items-center gap-2 rounded-input border px-4 py-2.5 text-sm font-medium transition-colors ${
          selected.length > 0
            ? 'border-ink bg-bg-card text-ink'
            : 'border-line-2 bg-bg-card text-ink-2 hover:border-ink'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2"
        >
          {triggerLabel}
          <span className="text-ink-4">▾</span>
        </button>
        {selected.length > 0 && (
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
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 max-h-80 w-64 overflow-hidden rounded-xl border border-line bg-bg-card shadow-lg">
          {searchable && (
            <div className="border-b border-line p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-ink"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-sm text-ink-3">No matches</div>
            )}
            {filtered.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-bg-alt"
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
