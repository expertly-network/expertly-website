import type { ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'emphasis' | 'brand' | 'success' | 'danger' | 'warning' | 'info';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-bg-alt text-ink-2',
  emphasis: 'bg-ink text-bg',
  brand: 'bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-accent',
  success: 'bg-[color-mix(in_oklab,var(--ok)_10%,transparent)] text-ok',
  danger: 'bg-[color-mix(in_oklab,var(--error)_10%,transparent)] text-error',
  // Same amber-50/amber-700 pair as SectionBadge's "pending verification" chip — now a second
  // call site, per design-system.md's own note to promote it once that happens.
  warning: 'bg-amber-50 text-amber-700',
  // Same one-off-Tailwind-default pattern as `warning`, for a status that isn't success/error/
  // pending-review but still needs its own distinct hue.
  info: 'bg-sky-50 text-sky-700',
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
