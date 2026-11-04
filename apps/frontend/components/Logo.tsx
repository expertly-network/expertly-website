import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LOGO_MARK_ASPECT_RATIO, LOGO_SRC, LOGO_ASPECT_RATIO } from '@/lib/brand';

// Complete vector lockups from the supplied GrowXQ artwork.
export type LogoSurface = keyof typeof LOGO_SRC;

/** `height` is the symbol height; --logo-h scales the entire image at responsive breakpoints. */
export function LogoImage({
  surface,
  height,
  className = '',
  priority = false,
}: {
  surface: LogoSurface;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      style={{ '--logo-h': `${height}px` } as CSSProperties}
      className={`inline-flex shrink-0 items-center whitespace-nowrap ${className}`}
    >
      <Image
        src={LOGO_SRC[surface]}
        alt="GrowXQ"
        width={Math.round(height * LOGO_ASPECT_RATIO)}
        height={height}
        priority={priority}
        unoptimized
        className="block h-[var(--logo-h)] w-auto"
      />
    </span>
  );
}

// Symbol height + surface per usage context.
const VARIANTS = {
  nav: { surface: 'light', height: 30 },
  auth: { surface: 'light', height: 30 },
  sidebar: { surface: 'dark', height: 26 },
} as const;

export function Logo({
  variant = 'nav',
  className = '',
  collapsible = false,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
  // When true (the sidebar's collapsed rail), only the symbol shows until the rail is hovered,
  // then the full logo fades in.
  collapsible?: boolean;
}) {
  const { surface, height } = VARIANTS[variant];

  return (
    <Link href="/" aria-label="GrowXQ home" className={`inline-flex items-center ${className}`}>
      {collapsible && (
        // Hidden while a stellar hero is in view (sidebar-logo-*); see HeroLogoHandoff.
        <svg
          aria-hidden="true"
          width={Math.round(26 * LOGO_MARK_ASPECT_RATIO)}
          height={26}
          viewBox="0 0 62 61"
          className="sidebar-logo-mark block h-[26px] w-auto overflow-hidden group-hover:hidden"
        >
          <image href={LOGO_SRC[surface]} width="299" height="61" />
        </svg>
      )}
      <span
        className={
          collapsible
            ? 'sidebar-logo-text hidden max-w-0 overflow-x-clip opacity-0 transition-[opacity,max-width] duration-200 group-hover:block group-hover:max-w-[200px] group-hover:opacity-100 group-hover:delay-150'
            : 'block'
        }
      >
        <LogoImage surface={surface} height={height} priority />
      </span>
    </Link>
  );
}
