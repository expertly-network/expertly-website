'use client';

import { useState } from 'react';
import { FilterPopover, type FilterPopoverOption } from '@/components/ui/FilterPopover';

// Built on top of FilterPopover rather than a second dropdown implementation.
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder,
  allowCustom = false,
  error,
}: {
  label: string;
  options: FilterPopoverOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Adds a free-text row that lets the typed value be selected even if not in options. */
  allowCustom?: boolean;
  error?: string;
}) {
  const [customValue, setCustomValue] = useState('');

  function addCustom() {
    const value = customValue.trim();
    if (!value || selected.includes(value)) return;
    onChange([...selected, value]);
    setCustomValue('');
  }

  function remove(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  function labelFor(value: string): string {
    return options.find((o) => o.value === value)?.label ?? value;
  }

  return (
    <div className="flex flex-col">
      <label className="mb-2 block text-[13px] font-semibold text-ink">{label}</label>
      <FilterPopover
        label={placeholder ?? label}
        options={options}
        selected={selected}
        onChange={onChange}
        fullWidth
        footer={
          allowCustom ? (
            <div className="flex gap-1.5 px-3.5 pt-2.5">
              <input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Type your own, press Enter…"
                className="min-w-0 flex-1 rounded-input border border-line-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent"
              />
            </div>
          ) : undefined
        }
      />
      {selected.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-bg-alt py-[5px] pl-3 pr-[5px] text-[12.5px] font-medium text-ink-2"
            >
              {labelFor(value)}
              <button
                type="button"
                aria-label={`Remove ${labelFor(value)}`}
                onClick={() => remove(value)}
                className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[12px] leading-none text-ink-4 hover:bg-line-2 hover:text-ink"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <span className="mt-1.5 text-xs text-error">{error}</span>}
    </div>
  );
}
