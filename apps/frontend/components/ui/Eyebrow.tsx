import type { ReactNode } from 'react';

// A small-caps label with a short accent dash before it.
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
