import type { ReactNode } from 'react';
import { Sidebar } from '@/components/nav/Sidebar';

// Matches design/static_html's .d1-shell. Desktop: CSS grid with a fixed 56px first column —
// confirmed live (getComputedStyle) that the real design keeps this track at a constant 56px
// even while the sidebar itself grows to 248px on hover, so the content column never shifts;
// the sidebar (sticky, no overflow-hidden ancestor) simply paints past its own track. Grid is
// what makes that work — a flex layout would have pushed the content when the sidebar's width
// changed. Mobile: single column, sidebar stacks as a horizontal bar above the content instead
// (see Sidebar.tsx's own responsive classes).
//
// Footer is deliberately empty (matches design/static_html's own
// <footer class="footer--minimal">, which is empty verbatim across every single page in the
// design — nothing to port content-wise, only the spacing).
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[56px_1fr]">
      <Sidebar />
      <div className="min-w-0">
        <main>{children}</main>
        <footer aria-label="Site footer" className="px-6 pb-[60px] pt-20" />
      </div>
    </div>
  );
}
