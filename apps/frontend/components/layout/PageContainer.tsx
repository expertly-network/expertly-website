import type { ReactNode } from 'react';

// The single source of truth for page content width — wrap section content in this instead
// of a one-off max-width.
export function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-[1520px] px-8 max-[720px]:px-5 ${className}`.trim()}>
      {children}
    </div>
  );
}
