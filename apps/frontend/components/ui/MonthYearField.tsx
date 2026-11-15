'use client';

import { useId } from 'react';
import { FIELD_FOCUS, FIELD_FOCUS_ERROR } from '@/components/ui/field-styles';
import { MONTHS } from '@/lib/apply/format';

// The last 67 years, newest first — never a future year.
const YEARS = Array.from({ length: 67 }, (_, i) => new Date().getFullYear() - i);

/**
 * A month + year pair of selects — a date with no day (work history, education). Selects, not free
 * text, so a month outside 1–12 or a future year can't be entered. `month` is 1–12 (or undefined).
 */
export function MonthYearField({
  label,
  month,
  year,
  onMonthChange,
  onYearChange,
  required,
  disabled,
  error,
  yearId,
}: {
  label: string;
  month: number | undefined | null;
  year: number | undefined | null;
  onMonthChange: (month: number | undefined) => void;
  onYearChange: (year: number | undefined) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  /** Id of the year select, for scroll-to-error. */
  yearId?: string;
}) {
  const labelId = useId();
  const selectClass = 'min-w-0 flex-1 rounded-input border px-2 py-3 text-sm text-ink disabled:opacity-40';
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-ink-2">
        {label}
        {required && (
          <span aria-hidden="true" className="text-error">
            {' '}
            *
          </span>
        )}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex gap-2">
        <select
          disabled={disabled}
          aria-label={`${label} — month`}
          className={`${selectClass} border-line ${FIELD_FOCUS}`}
          value={month ?? ''}
          onChange={(e) => onMonthChange(Number(e.target.value) || undefined)}
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          id={yearId}
          disabled={disabled}
          aria-label={`${label} — year`}
          aria-invalid={error ? true : undefined}
          className={`${selectClass} ${error ? `border-error ${FIELD_FOCUS_ERROR}` : `border-line ${FIELD_FOCUS}`}`}
          value={year ?? ''}
          onChange={(e) => onYearChange(Number(e.target.value) || undefined)}
        >
          <option value="">Year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
