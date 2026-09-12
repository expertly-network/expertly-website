import type { ReactNode } from 'react';

// Omit headerIcon/headerTitle for a card with no header.
export function WriteCard({
  headerIcon,
  headerTitle,
  children,
  className = '',
}: {
  headerIcon?: ReactNode;
  headerTitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-card-lg border border-line bg-bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03),0_40px_80px_-36px_rgba(0,0,0,0.22)] ${className}`.trim()}
    >
      {headerTitle && (
        <div className="flex items-center gap-3 border-b border-line px-8 py-[22px] text-[15.5px] font-semibold text-ink">
          {headerIcon && (
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-[color-mix(in_oklab,var(--accent)_13%,transparent)] text-accent">
              {headerIcon}
            </span>
          )}
          {headerTitle}
        </div>
      )}
      <div className="flex flex-col gap-5 p-8">{children}</div>
    </div>
  );
}
