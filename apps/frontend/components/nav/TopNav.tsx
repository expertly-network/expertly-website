import { getSessionUser } from '@/lib/auth/session-claims';
import { UserMenu } from '@/components/nav/UserMenu';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';

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
          <Button href="/login" size="sm">
            Log in
          </Button>
        )}
      </div>
    </header>
  );
}
