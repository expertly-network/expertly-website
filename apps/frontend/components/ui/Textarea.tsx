'use client';

import { useEffect, useRef, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  labelRight?: ReactNode;
  hint?: ReactNode;
  /** Red border + message below the field — see Input's identical prop for the convention.
   * Takes over from `hint` when present (a field shouldn't show both at once). */
  error?: string;
  /**
   * Grows to fit its content instead of staying at a fixed `rows` height that clips long text
   * behind a scrollbar. Re-measures on every value change, including a value set programmatically
   * (e.g. a LinkedIn import filling the field), not just on typing — `rows` still sets the
   * starting height before content is measured.
   */
  autoGrow?: boolean;
}

export function Textarea({
  label,
  labelRight,
  hint,
  id,
  error,
  autoGrow,
  value,
  className = '',
  ...textareaProps
}: TextareaProps) {
  const fieldId = id ?? textareaProps.name;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!autoGrow || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow, value]);

  return (
    <div className="flex flex-col gap-1.5">
      {(label || labelRight) && (
        <label htmlFor={fieldId} className="flex items-center justify-between text-xs font-medium text-ink-2">
          <span>{label}</span>
          {labelRight}
        </label>
      )}
      <textarea
        ref={textareaRef}
        id={fieldId}
        value={value}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-input border px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-[3px] ${
          autoGrow ? 'resize-none overflow-hidden' : 'resize-y'
        } ${
          error
            ? 'border-error focus:border-error focus:ring-error/[0.08]'
            : 'border-line focus:border-ink focus:ring-ink/[0.08]'
        } ${className}`}
        {...textareaProps}
      />
      {error ? <span className="text-xs text-error">{error}</span> : hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}
