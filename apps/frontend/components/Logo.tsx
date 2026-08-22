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
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="Expertly home"
      className={`inline-flex items-baseline font-semibold tracking-[-0.02em] ${VARIANTS[variant]} ${className}`}
    >
      Expertly<span className="text-accent-2">.</span>
    </Link>
  );
}
