import type { ReactNode } from 'react';

// The single source of truth for page content width — every section on every page should
// wrap its content in this instead of hand-rolling `mx-auto max-w-[Npx] px-N`, which is how
// this app ended up with 5+ different ad-hoc widths (1150/1200/1360/1520px) across pages that
// were all meant to look consistently "full width". Matches design/static_html's own
// `.container-wide` (`max-width: 1520px; padding: 0 32px`, `0 20px` below 720px) — the width
// already fixed-and-approved on the members directory earlier this session.
//
// Deliberately narrow, single-column reading content (the guest article excerpt preview,
// the post-application confirmation screen) is a different design intent, not this "did we
// forget full width" bug — those stay as local one-off max-widths, not this component.
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
