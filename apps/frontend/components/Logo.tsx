import Link from 'next/link';

// Text size/color per usage context.
const VARIANTS = {
  nav: 'text-[23px] text-nav-green',
  auth: 'text-2xl text-ink',
  sidebar: 'text-[20px] text-white',
} as const;

export function Logo({
  variant = 'nav',
  className = '',
  collapsible = false,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
  // When true, "xpertly" collapses to zero width, showing only "E." until hovered.
  collapsible?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Expertly home"
      className={`inline-flex items-baseline font-semibold tracking-[-0.02em] ${VARIANTS[variant]} ${className}`}
    >
      {/* Hidden while a stellar hero is in view; see HeroLogoHandoff. */}
      <span className={collapsible ? 'sidebar-logo-mark' : ''}>E</span>
      <span
        className={
          collapsible
            ? 'sidebar-logo-text max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[opacity,max-width] duration-200 group-hover:max-w-[140px] group-hover:opacity-100 group-hover:delay-150'
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
