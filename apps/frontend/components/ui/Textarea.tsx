import type { ReactNode, TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  labelRight?: ReactNode;
  hint?: ReactNode;
}

export function Textarea({ label, labelRight, hint, id, ...textareaProps }: TextareaProps) {
  const fieldId = id ?? textareaProps.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="flex items-center justify-between text-xs font-medium text-ink-2">
        <span>{label}</span>
        {labelRight}
      </label>
      <textarea
        id={fieldId}
        className="w-full resize-y rounded-input border border-line px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/[0.08]"
        {...textareaProps}
      />
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}
