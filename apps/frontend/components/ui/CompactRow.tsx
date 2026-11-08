import type { ReactNode } from 'react';

// Phone list row — the replacement for a tall card in a long list (rules: apps/frontend/CLAUDE.md →
// "Mobile-first rules"): a small leading visual, an accent eyebrow, a two-line title, one meta line
// and a trailing cue. Tapping opens the item's detail (dialog, drawer). Render inside
// `CompactRowList`. Phone-only by convention: pages keep their card grid from `sm` up.
export function CompactRow({
  leading,
  eyebrow,
  title,
  meta,
  trailing,
  onClick,
}: {
  leading: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Right-hand cue; defaults to a chevron. */
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full min-w-0 items-center gap-3.5 py-3.5 text-left"
      >
        <span className="flex-none">{leading}</span>
        <span className="min-w-0 flex-1">
          {eyebrow && <span className="block truncate text-[11px] font-medium text-accent">{eyebrow}</span>}
          <span className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug text-ink group-hover:text-accent">
            {title}
          </span>
          {meta && <span className="mt-1 block truncate text-xs text-ink-3">{meta}</span>}
        </span>
        {trailing ?? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="flex-none text-ink-4"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </li>
  );
}

/** The list wrapper for CompactRow: hairline dividers, phone-only (`sm:hidden`) by default. */
export function CompactRowList({
  label,
  className = 'sm:hidden',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul aria-label={label} className={`divide-y divide-line border-y border-line ${className}`.trim()}>
      {children}
    </ul>
  );
}
