import type { ReactNode } from 'react';

// Matches AuthCard's card treatment (rounded-card border bg-bg-card, generous
// padding that collapses on mobile) — generalized so other pages don't hand-roll
// the same border/radius/padding combination.
export function Card({
  children,
  className = '',
  padding = 'lg',
}: {
  children: ReactNode;
  className?: string;
  padding?: 'lg' | 'md';
}) {
  const paddingClasses = padding === 'lg' ? 'p-10 max-[640px]:px-6 max-[640px]:py-7' : 'p-6';

  return (
    <div className={`rounded-card border border-line bg-bg-card ${paddingClasses} ${className}`.trim()}>
      {children}
    </div>
  );
}
