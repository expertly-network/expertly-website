import type { CSSProperties, ReactNode } from 'react';

// Matches AuthCard's card treatment (rounded-card border bg-bg-card, generous
// padding that collapses on mobile) — generalized so other pages don't hand-roll
// the same border/radius/padding combination.
export function Card({
  children,
  className = '',
  padding = 'lg',
  style,
}: {
  children: ReactNode;
  className?: string;
  // 'xl' (56px, design/static_html's `.dual-card` padding) is deliberately larger than
  // 'lg' — a genuinely bigger card (the homepage's two-way-in split cards). Add variants
  // here rather than a one-off className override, which would fight the existing padding
  // utility at unpredictable specificity.
  padding?: 'xl' | 'lg' | 'md';
  // Escape hatch for genuinely dynamic backgrounds (e.g. a decorative gradient/texture
  // that can't be expressed as a static Tailwind utility) — not for static styling, which
  // belongs in `className`.
  style?: CSSProperties;
}) {
  const paddingClasses =
    padding === 'xl'
      ? 'p-14 max-[640px]:px-6 max-[640px]:py-7'
      : padding === 'lg'
        ? 'p-10 max-[640px]:px-6 max-[640px]:py-7'
        : 'p-6';

  return (
    <div
      style={style}
      className={`rounded-card border border-line bg-bg-card ${paddingClasses} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
