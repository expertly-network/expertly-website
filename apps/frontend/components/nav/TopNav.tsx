import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session-claims';
import { UserMenu } from '@/components/nav/UserMenu';
import { Logo } from '@/components/Logo';

// Role-aware nav shell. Nav links to other site sections (Members, Articles,
// Events…) are intentionally left out until those pages ship — this iteration
// only has Home, Login, and Dashboard, and linking to pages that don't exist yet
// would just be dead links. Add them here as each one is built.
export async function TopNav() {
  const profile = await getSessionUser();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between px-6">
        <Logo variant="nav" />

        {profile ? (
          <UserMenu profile={profile} />
        ) : (
          <Link
            href="/login"
            className="flex min-h-[44px] items-center rounded-[10px] bg-ink px-5 text-sm font-medium text-bg transition-colors hover:bg-ink-2"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
