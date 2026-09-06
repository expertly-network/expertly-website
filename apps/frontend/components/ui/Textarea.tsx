import type { ReactNode, TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  labelRight?: ReactNode;
  hint?: ReactNode;
  /** Red border + message below the field — see Input's identical prop for the convention.
   * Takes over from `hint` when present (a field shouldn't show both at once). */
  error?: string;
}

export function Textarea({ label, labelRight, hint, id, error, ...textareaProps }: TextareaProps) {
  const fieldId = id ?? textareaProps.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="flex items-center justify-between text-xs font-medium text-ink-2">
        <span>{label}</span>
        {labelRight}
      </label>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={`w-full resize-y rounded-input border px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-[3px] ${
          error
            ? 'border-error focus:border-error focus:ring-error/[0.08]'
            : 'border-line focus:border-ink focus:ring-ink/[0.08]'
        }`}
        {...textareaProps}
      />
      {error ? <span className="text-xs text-error">{error}</span> : hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}
