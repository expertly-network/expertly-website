import Link from 'next/link';

// `nav` = 23px/nav-green, matching theme.css's `.nav-logo`.
// `auth` = 24px/ink (no special color), matching auth.css's `.auth-logo` —
// used on pages like /login that don't render the main site nav.
const VARIANTS = {
  nav: 'text-[23px] text-nav-green',
  auth: 'text-2xl text-ink',
  // 20px/white, matching dashboard-shell.css's .d1-logo — the dark left sidebar's own logo
  // treatment, distinct from `nav` (used on the old top-bar, kept for any page not yet on
  // the sidebar shell).
  sidebar: 'text-[20px] text-white',
} as const;

export function Logo({
  variant = 'nav',
  className = '',
  collapsible = false,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
  // When true, "xpertly" collapses to zero width and fades out — for use inside Sidebar's
  // hover-to-expand icon rail (a `group`-classed ancestor), where only "E." shows at the
  // 56px collapsed width (the accent dot stays visible even collapsed — it's a sibling of
  // "xpertly", not nested inside it). Matches design/static_html's `.d1-logo-mark` (always
  // visible) + standalone `.dot` (visible by default, only hidden by the `.revealed`-gated
  // opacity rules) vs `.d1-logo-full` ("xpertly" text only, fades in on `.d1-shell.revealed`).
  collapsible?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Expertly home"
      className={`inline-flex items-baseline font-semibold tracking-[-0.02em] ${VARIANTS[variant]} ${className}`}
    >
      {/* sidebar-logo-mark: targeted by globals.css's `html.in-hero` rule, which hides this
          "E" (crossfading to HeroLogoHandoff's floating wordmark instead) while a page's
          stellar hero is in view, restoring it on group-hover same as the design's own
          `.revealed` override — see that CSS block for the full mechanism. */}
      <span className={collapsible ? 'sidebar-logo-mark' : ''}>E</span>
      <span
        className={
          collapsible
            ? 'max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[opacity,max-width] duration-200 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:delay-150'
            : ''
        }
      >
        xpertly
      </span>
      <span
        className={`text-accent-2 ${collapsible ? 'sidebar-logo-dot ml-px mb-px h-1.5 w-1.5 flex-none rounded-full bg-accent-2' : ''}`}
      >
        {collapsible ? '' : '.'}
      </span>
    </Link>
  );
}
