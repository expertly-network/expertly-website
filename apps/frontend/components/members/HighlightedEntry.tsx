import type { ReactNode } from 'react';

// One entry of a profile's Education / Awards list: the year (or a plain icon when there is none)
// in accent on the left, then a soft accent rule with the title, a supporting line and an optional
// description. Boxless on purpose. The profile PDF mirrors it (`HighlightedEntry` in
// components/members/pdf/MemberProfilePdf.tsx) — change both together.
export function HighlightedEntry({
  year,
  icon,
  title,
  subtitle,
  description,
  actions,
  footer,
}: {
  year: number | null;
  /** Shown in the year's place when there is no year. */
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  /** Right of the title: the verification badge, the owner's Edit / reorder buttons. */
  actions?: ReactNode;
  /** Below the entry: e.g. a message from the GrowXQ team (owner only). */
  footer?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[3.25rem_1fr] gap-x-3 sm:grid-cols-[4rem_1fr] sm:gap-x-4">
      <div className="pt-px text-title font-semibold tabular-nums text-accent">{year ?? icon}</div>
      <div className="min-w-0 border-l-2 border-[color-mix(in_oklab,var(--accent)_35%,transparent)] pl-3 sm:pl-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1 text-profile-item font-semibold text-ink">{title}</div>
          {actions && <div className="flex flex-none flex-wrap items-center gap-1.5">{actions}</div>}
        </div>
        {subtitle && <div className="mt-[3px] text-profile-meta font-medium text-ink-2">{subtitle}</div>}
        {description && <div className="mt-1.5 text-caption leading-relaxed text-ink-3">{description}</div>}
        {footer}
      </div>
    </li>
  );
}

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const TROPHY_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
    <path d="M7 6H4a1 1 0 00-1 1v1a3 3 0 003 3M17 6h3a1 1 0 011 1v1a3 3 0 01-3 3" />
  </svg>
);

export const GRADUATION_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M2 9l10-5 10 5-10 5-10-5z" />
    <path d="M6 11.5V16c0 1.2 2.7 3 6 3s6-1.8 6-3v-4.5" />
  </svg>
);
