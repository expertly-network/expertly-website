import type { ReactNode } from 'react';
import { AuthRightPanel } from '@/components/auth/AuthRightPanel';
import { Logo } from '@/components/Logo';

// Shared frame for every auth page (login/signup, forgot-password,
// reset-password) — logo + the branded two-column grid — so branding never
// drifts between pages in the same flow. `children` is the left column's
// content (typically a `Card`).
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen">
      {/* Pinned to the page's actual top-left corner (theme.css's standard
          32px page margin), independent of the card column's own padding —
          matches where the logo sits in the design (the sidebar we didn't
          build), not indented in line with the card. */}
      <Logo variant="auth" className="absolute left-8 top-8 z-10" />

      {/* auth-grid: 2 columns >=1000px (auth.css's breakpoint), collapses to 1
          column (right panel hidden) below it — matches the mockup exactly. */}
      <div className="grid min-h-screen grid-cols-1 min-[1000px]:grid-cols-2">
        {/* [justify-content:safe_center], not the named `justify-[safe_center]`
            utility — Tailwind's arbitrary-*value* syntax silently drops
            multi-keyword values like "safe center" (no CSS emitted, no build
            error either), which is why an earlier version of this rendered as
            plain `justify-content: normal` and looked top-packed instead of
            centered. The arbitrary-*property* syntax below passes the value
            through untouched.
            Plain `justify-center` divides *all* leftover space evenly above/
            below the content, including negative leftover when content (e.g.
            the 6-field sign-up form on a short/mobile viewport) is taller
            than the column — pushing the overflow upward past y=0, straight
            into the fixed-position Logo above. "safe center" is the CSS-spec
            answer: center when it fits, fall back to top-alignment
            (respecting py-24 below) when it doesn't, so tall content just
            extends downward and scrolls instead of colliding with the logo.
            py-24 is symmetric top AND bottom on purpose — AuthRightPanel
            centers within its own symmetric p-12, so asymmetric padding here
            would shift this column's true center away from the container's
            actual vertical middle, visibly misaligning the two columns even
            though both claim to be "centered". Equal top/bottom padding is
            what makes the two centered blocks land on the same horizontal
            line. */}
        <div className="mx-auto flex w-full max-w-[640px] flex-col [justify-content:safe_center] px-12 py-24 max-[1000px]:px-8 max-[640px]:px-5">
          {children}
        </div>
        <AuthRightPanel />
      </div>
    </main>
  );
}
