import type { ReactNode } from 'react';
import { VerificationBadge } from '@/components/members/VerificationBadge';

// design/static_html/assets/styles.css's .mp-section-header / .mp-section-label / .mp-edit-btn —
// the header row every profile tab section shares: small Archivo label with an accent icon,
// an optional verification badge (only where one verification state covers the whole section —
// the contact block), and owner-only buttons on the right: "+ New" adds an entry to a list section,
// "Edit" opens a section edited as a whole.
const OWNER_BUTTON =
  'inline-flex flex-none items-center gap-[5px] rounded-lg border border-[color-mix(in_oklab,var(--accent)_20%,transparent)] bg-black/5 px-3 py-[5px] font-mono text-caption font-semibold text-ink-2 transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]';

export function ProfileSectionHeader({
  label,
  icon,
  verified,
  onEdit,
  onNew,
  hideLabel,
}: {
  label: string;
  /** Keeps the label for screen readers only — for a section the tab above already names (About). */
  hideLabel?: boolean;
  icon?: ReactNode;
  /** Shows a verification badge next to the label; omit for sections verified entry by entry. */
  verified?: boolean;
  onEdit?: () => void;
  onNew?: () => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${hideLabel ? (onEdit || onNew ? 'mb-3' : '') : 'mb-4'}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <h2
          className={`flex items-center gap-1.5 font-mono text-profile-label font-bold text-ink-3 ${hideLabel ? 'sr-only' : ''}`}
        >
          {icon}
          {label}
        </h2>
        {verified !== undefined && <VerificationBadge verified={verified} />}
      </div>
      <div className="flex flex-none items-center gap-2">
        {onNew && (
          <button type="button" onClick={onNew} className={OWNER_BUTTON}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit} className={OWNER_BUTTON}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

/** A small owner-only "Edit" link for one entry of a list section. */
export function EntryEditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex flex-none items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-caption font-semibold text-ink-3 transition-colors hover:bg-black/5 hover:text-ink"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Edit
    </button>
  );
}

// `.mp-eng-empty` — the owner-only dashed empty state pointing at the Edit button.
export function ProfileSectionEmpty({
  title,
  hint,
  onEdit,
  actionLabel = 'click Edit',
}: {
  title: string;
  hint?: string;
  onEdit?: () => void;
  /** The button the owner is pointed at — "click Edit" for a whole-section edit, "click New" for a list. */
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--accent)_25%,transparent)] bg-[color-mix(in_oklab,var(--accent)_4%,transparent)] px-[22px] py-5 text-profile-item text-ink-3">
      <strong className="font-semibold">{title}</strong>
      {onEdit && hint && (
        <>
          {' '}
          {hint} -{' '}
          <button type="button" onClick={onEdit} className="font-semibold text-ink-2 underline">
            {actionLabel}
          </button>{' '}
          to add one.
        </>
      )}
    </div>
  );
}

export const SECTION_ICONS = {
  engagements: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="flex-none">
      <path d="M8 1L10 6h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5L8 1z" fill="var(--accent)" />
    </svg>
  ),
  clients: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="4" stroke="var(--accent)" strokeWidth="1.6" />
      <path
        d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  education: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
      <path d="M12 3L22 8l-10 5L2 8l10-5z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 11v5c0 2.2 2.7 4 6 4s6-1.8 6-4v-5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  work: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
      <rect x="2" y="7" width="20" height="14" rx="2" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="var(--accent)" strokeWidth="1.6" />
    </svg>
  ),
  testimonials: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  awards: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
      <path
        d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 6H4a1 1 0 00-1 1v1a3 3 0 003 3M17 6h3a1 1 0 011 1v1a3 3 0 01-3 3"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};
