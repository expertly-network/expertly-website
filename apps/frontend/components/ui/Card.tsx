import type { CSSProperties, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  padding = 'lg',
  style,
}: {
  children: ReactNode;
  className?: string;
  /** `sm` (20px) is for narrow sidebar cards, e.g. the member profile's 288px column. */
  padding?: 'xl' | 'lg' | 'md' | 'sm';
  /** Escape hatch for dynamic backgrounds only, not static styling. */
  style?: CSSProperties;
}) {
  const paddingClasses =
    padding === 'xl'
      ? 'p-14 max-[640px]:px-6 max-[640px]:py-7'
      : padding === 'lg'
        ? 'p-10 max-[640px]:px-6 max-[640px]:py-7'
        : padding === 'md'
          ? 'p-6'
          : 'p-5';

  return (
    <div
      style={style}
      className={`rounded-card border border-line bg-bg-card ${paddingClasses} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
