// The verification state of one profile entry (or the contact block). Edits go live at once; until
// the GrowXQ team has checked an entry it shows the soft yellow circled "i" (no wording; the explanation is the
// tooltip on hover / focus / tap), then a green "Verified" once it is checked.
export const PENDING_VERIFICATION_TOOLTIP =
  'This is live on the profile but has not been verified by GrowXQ yet. We may ask for proof.';

export function VerificationBadge({ verified, className = '' }: { verified: boolean; className?: string }) {
  if (verified) {
    return (
      <span
        className={`inline-flex flex-none items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-2.5 py-1 text-[11px] font-bold text-accent ${className}`}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified
      </span>
    );
  }
  return (
    // Focusable so the explanation is reachable by keyboard and touch, not only on hover.
    <span
      tabIndex={0}
      title={PENDING_VERIFICATION_TOOLTIP}
      className={`group relative inline-flex h-6 w-6 flex-none cursor-help items-center justify-center rounded-full bg-warn-soft text-[11px] font-semibold text-warn outline-none focus-visible:ring-2 focus-visible:ring-warn/40 ${className}`}
    >
      <span className="sr-only">Pending verification</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-60 rounded-lg bg-ink px-3 py-2 text-left text-[11.5px] font-normal leading-snug text-bg-card shadow-lg group-hover:block group-focus-visible:block"
      >
        {PENDING_VERIFICATION_TOOLTIP}
      </span>
    </span>
  );
}
