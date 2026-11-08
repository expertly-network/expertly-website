'use client';

import Link from 'next/link';
import { STICKY_UNDER_MOBILE_BAR } from '@/lib/ui/mobile';

/** One active filter shown as a removable chip: a button (`onRemove`) or a link (`href`, e.g. "clear search"). */
export type FilterChip = { key: string; label: string } & ({ onRemove: () => void } | { href: string });

const CHIP_CLASS =
  'inline-flex min-h-9 max-w-[260px] items-center gap-1.5 rounded-full bg-bg-alt px-3 text-xs font-medium text-ink-2';

// The phone half of a filterable list (hidden from `sm` up, where pages show FilterPopover
// dropdowns): a sticky bar under the mobile top bar with a "Filters" button — badge = active
// filter count — and the result count, then the active filters as removable chips. `onOpen`
// opens the page's FilterSheet. Pair with docs/design-system.md → "Bottom sheet & phone filters".
export function MobileFilterBar({
  activeCount,
  countLabel,
  onOpen,
  chips = [],
}: {
  activeCount: number;
  /** e.g. "238 articles" or "Loading…"; announced politely as it changes. */
  countLabel: string;
  onOpen: () => void;
  chips?: FilterChip[];
}) {
  return (
    <>
      <div
        className={`sticky ${STICKY_UNDER_MOBILE_BAR} z-10 -mx-5 flex items-center justify-between gap-3 border-b border-line bg-bg px-5 py-2.5 sm:hidden`}
      >
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center gap-2 rounded-input border border-line-2 bg-bg-card px-4 text-sm font-medium text-ink"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-bg-card">
              {activeCount}
            </span>
          )}
        </button>
        <span className="font-mono text-xs text-ink-3" aria-live="polite">
          {countLabel}
        </span>
      </div>
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 sm:hidden" aria-label="Active filters">
          {chips.map((chip) => {
            const content = (
              <>
                <span className="truncate">{chip.label}</span>
                <span aria-hidden="true" className="text-ink-4">
                  ✕
                </span>
              </>
            );
            return (
              <li key={chip.key}>
                {'href' in chip ? (
                  <Link href={chip.href} scroll={false} aria-label={`Clear ${chip.label}`} className={CHIP_CLASS}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Remove filter: ${chip.label}`}
                    className={CHIP_CLASS}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
