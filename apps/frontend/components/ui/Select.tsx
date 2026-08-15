import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

export function Select({ label, id, children, ...selectProps }: SelectProps) {
  const fieldId = id ?? selectProps.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      <select
        id={fieldId}
        className="w-full rounded-input border border-line bg-bg px-3.5 py-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/[0.08]"
        {...selectProps}
      >
        {children}
      </select>
    </div>
  );
}
