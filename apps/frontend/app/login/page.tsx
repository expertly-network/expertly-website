import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthRightPanel } from '@/components/auth/AuthRightPanel';
import { Logo } from '@/components/Logo';
import type { AuthMode } from '@/components/auth/AuthTabs';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { mode?: string; returnTo?: string };
}) {
  const profile = await getSessionUser();
  if (profile) {
    redirect(searchParams.returnTo ?? '/');
  }

  const initialMode: AuthMode = searchParams.mode === 'member' ? 'member' : 'user';
  const returnTo = searchParams.returnTo ?? '/';

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
        {/* Fixed top offset, not dynamic centering — a shorter tab's content
            (Member) should start at the same point as a taller one (User)
            and just end earlier, not re-center and shift the whole card. */}
        <div className="mx-auto flex w-full max-w-[640px] flex-col px-12 pb-14 pt-28 max-[1000px]:px-8 max-[1000px]:pb-10 max-[1000px]:pt-20 max-[640px]:px-5 max-[640px]:pb-8 max-[640px]:pt-16">
          <AuthCard initialMode={initialMode} returnTo={returnTo} />
        </div>
        <AuthRightPanel />
      </div>
    </main>
  );
}
