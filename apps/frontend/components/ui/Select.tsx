import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
  /** Red border + message below the field — see Input's identical prop for the convention. */
  error?: string;
}

export function Select({ label, id, children, error, ...selectProps }: SelectProps) {
  const fieldId = id ?? selectProps.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-input border bg-bg px-3.5 py-3 text-sm text-ink focus:outline-none focus:ring-[3px] ${
          error
            ? 'border-error focus:border-error focus:ring-error/[0.08]'
            : 'border-line focus:border-ink focus:ring-ink/[0.08]'
        }`}
        {...selectProps}
      >
        {children}
      </select>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
