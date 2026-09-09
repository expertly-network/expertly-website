import type { ReactNode } from 'react';

// Matches design/static_html/assets/styles.css's `.anv-write-card` (+ `.anv-write-card-head`/
// `.anv-write-card-body`) — the write flow's own card treatment, visually heavier than the app's
// normal `Card` component (bigger radius, deeper shadow) since the prototype treats this flow as
// its own elevated moment. `headerIcon`/`headerTitle` render the icon-chip + title header row;
// omit both for a card with no header (e.g. the success screen, which builds its own layout).
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
