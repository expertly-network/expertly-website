import type { ReactNode } from 'react';

// A small-caps label with a short accent dash before it — design/static_html's `.eyebrow`
// (theme.css): `::before { width:22px; height:2px; background:var(--accent) }`, `gap:9px`.
// Present before literally every section eyebrow in the design and was missing everywhere in
// this app (plain text only) — centralized here instead of re-adding the dash markup at each
// call site.
export function Eyebrow({
  children,
  className = '',
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[9px] text-eyebrow ${dark ? 'text-white/55' : 'text-accent'} ${className}`.trim()}
    >
      <span aria-hidden="true" className="h-0.5 w-[22px] flex-none rounded-full bg-accent" />
      {children}
    </span>
  );
}
