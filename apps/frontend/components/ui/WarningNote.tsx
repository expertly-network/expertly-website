import type { ReactNode } from 'react';

// Non-blocking heads-up under a field (e.g. overlapping work-history dates): amber, with a warning
// sign, so it reads as "double-check this" rather than a red validation error.
export function WarningNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-input border border-warn-line bg-warn-soft px-3 py-2 text-xs leading-5 text-warn ${className}`}
    >
      <span aria-hidden="true" className="shrink-0 text-sm leading-5">
        ⚠️
      </span>
      <span>{children}</span>
    </p>
  );
}
