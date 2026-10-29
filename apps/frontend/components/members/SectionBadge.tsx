// Matches design/static_html/assets/styles.css's .mp-badge-pending/.mp-badge-verified exactly
// (colors, pill shape) — the section-level counterpart to the sidebar's whole-profile
// "GrowXQ Verified" card.
export function SectionBadge({ status }: { status: 'pending' | 'verified' | null }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        Pending verification
      </span>
    );
  }

  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-2.5 py-1 text-[11px] font-bold text-accent">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified
      </span>
    );
  }

  return null;
}
