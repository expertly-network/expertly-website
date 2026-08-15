import type { ReactNode } from 'react';

// The 3 chip/badge treatments docs/design-system.md documents under "Color
// combination rules" — 'brand' matches MemberBenefitsPanel's inline badge
// verbatim (same color-mix expression), now available without re-deriving it.
export type BadgeVariant = 'neutral' | 'emphasis' | 'brand';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-bg-alt text-ink-2',
  emphasis: 'bg-ink text-bg',
  brand: 'bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-accent',
};

export function Badge({
  variant = 'neutral',
  children,
  className = '',
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] ${VARIANT_CLASSES[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
