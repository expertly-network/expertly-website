import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelRight?: ReactNode;
  error?: string;
}

export function Input({ label, labelRight, error, id, ...inputProps }: InputProps) {
  const fieldId = id ?? inputProps.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="flex items-center justify-between text-xs font-medium text-ink-2">
        <span>{label}</span>
        {labelRight}
      </label>
      <input
        id={fieldId}
        className={`w-full rounded-input border px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-[3px] ${
          error
            ? 'border-error focus:border-error focus:ring-error/[0.08]'
            : 'border-line focus:border-ink focus:ring-ink/[0.08]'
        }`}
        aria-invalid={error ? true : undefined}
        {...inputProps}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
