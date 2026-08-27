import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  labelRight?: ReactNode;
  children: ReactNode;
  error?: string;
}

export function Select({ label, labelRight, id, children, error, ...selectProps }: SelectProps) {
  const fieldId = id ?? selectProps.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="flex items-center justify-between text-xs font-medium text-ink-2">
        <span>{label}</span>
        {labelRight}
      </label>
      <select
        id={fieldId}
        className={`w-full rounded-input border bg-bg px-3.5 py-3 text-sm text-ink focus:outline-none focus:ring-[3px] ${
          error
            ? 'border-error focus:border-error focus:ring-error/[0.08]'
            : 'border-line focus:border-ink focus:ring-ink/[0.08]'
        }`}
        aria-invalid={error ? true : undefined}
        {...selectProps}
      >
        {children}
      </select>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
