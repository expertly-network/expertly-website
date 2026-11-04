import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelRight?: ReactNode;
  /** Red border + message below the field — e.g. from a form's inline/scroll-to-error
   * validation. Absent/undefined renders the normal (non-error) state. */
  error?: string;
  /** Helper text below the field, same as Textarea's; `error` takes over when present. */
  hint?: ReactNode;
  /** Appends a red asterisk to the label, for forms that mark required fields (article forms). */
  markRequired?: boolean;
  /** Draws the eye to the one field a step is about (green border + glow, stronger label) while it's
   * still empty; it settles to the normal look once filled. Errors still take precedence. */
  highlight?: boolean;
}

export function Input({
  label,
  labelRight,
  id,
  error,
  hint,
  markRequired,
  highlight,
  className,
  ...inputProps
}: InputProps) {
  // Falls back to a generated id so the <label> is always tied to the control, even when a call
  // site passes neither `id` nor `name`.
  const generatedId = useId();
  const fieldId = id ?? inputProps.name ?? generatedId;
  const emphasised = Boolean(highlight) && !error && !String(inputProps.value ?? '').trim();

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={fieldId}
          className={`flex items-center justify-between ${emphasised ? 'text-sm font-semibold text-ink' : 'text-xs font-medium text-ink-2'}`}
        >
          <span>
            {label}
            {markRequired && (
              <span aria-hidden="true" className="text-error">
                {' '}
                *
              </span>
            )}
          </span>
          {labelRight}
        </label>
      )}
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-input border px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-[3px] ${
          error
            ? 'border-error focus:border-error focus:ring-error/[0.08]'
            : emphasised
              ? 'border-accent bg-bg-card shadow-[0_0_0_4px_var(--neon)] focus:border-accent focus:ring-accent/20'
              : 'border-line focus:border-ink focus:ring-ink/[0.08]'
        } ${className ?? ''}`}
        {...inputProps}
      />
      {error ? (
        <span className="text-xs text-error">{error}</span>
      ) : (
        hint && <span className="text-xs text-ink-3">{hint}</span>
      )}
    </div>
  );
}
