import Link from 'next/link';

// The GrowXQ wordmark: lowercase "grow" with a raised green "XQ", like an exponent. "grow" is set in
// the headline serif (Cormorant Garamond Semibold, as in the homepage hero) and "XQ" in Geist
// Semibold, so the logo pairs the site's two fonts. Real text — crisp at any size and themeable.
// Size it with a text-[…] class; colour comes from `tone`.
export function Wordmark({ tone = 'ink', className = '' }: { tone?: 'ink' | 'white'; className?: string }) {
  return (
    <span
      className={`whitespace-nowrap font-[family-name:var(--font-brand-serif)] font-semibold leading-none tracking-[-0.01em] ${tone === 'white' ? 'text-white' : 'text-ink'} ${className}`}
    >
      grow
      <sup className="ml-[0.04em] align-[0.85em] font-sans text-[0.4em] font-semibold tracking-[-0.02em] text-accent">
        XQ
      </sup>
    </span>
  );
}

// Size + tone per usage context.
const VARIANTS = {
  nav: { tone: 'ink', size: 'text-[28px]' },
  auth: { tone: 'ink', size: 'text-[32px]' },
  sidebar: { tone: 'white', size: 'text-[26px]' },
} as const;

export function Logo({
  variant = 'nav',
  className = '',
  collapsible = false,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
  // When true (the sidebar's collapsed rail), only the green "XQ" mark shows until the rail is
  // hovered, then the full wordmark fades in.
  collapsible?: boolean;
}) {
  const { tone, size } = VARIANTS[variant];

  return (
    <Link href="/" aria-label="GrowXQ home" className={`inline-flex items-center ${className}`}>
      {collapsible && (
        // Hidden while a stellar hero is in view (sidebar-logo-*); see HeroLogoHandoff.
        <span
          aria-hidden="true"
          className="sidebar-logo-mark font-sans text-[15px] font-bold tracking-[-0.03em] text-accent group-hover:hidden"
        >
          XQ
        </span>
      )}
      <span
        className={
          collapsible
            ? 'sidebar-logo-text hidden max-w-0 overflow-x-clip opacity-0 transition-[opacity,max-width] duration-200 group-hover:block group-hover:max-w-[200px] group-hover:opacity-100 group-hover:delay-150'
            : 'block'
        }
      >
        <Wordmark tone={tone} className={size} />
      </span>
    </Link>
  );
}
