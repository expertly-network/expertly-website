import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { SiteShell } from '@/components/layout/SiteShell';

// Defense in depth alongside middleware.ts's redirect — this page also checks
// directly so it stays correct even if a future refactor changes the middleware
// matcher.
export default async function DashboardPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/dashboard');
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-[1360px] px-6 py-12">
        <h1 className="text-2xl font-semibold text-ink">
          Welcome, {profile.first_name || profile.email}.
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          Signed in as <strong>{profile.role}</strong>.
        </p>
        {profile.role === 'member' && (
          <p className="mt-6 text-sm text-ink-3">
            Member Portal (Peer Connect, Learnings, Templates, Perks…) is coming in a future
            iteration.
          </p>
        )}
        {profile.role === 'client' && (
          <p className="mt-6 text-sm text-ink-3">
            Client account — consultation requests and the member directory are coming in a
            future iteration.
          </p>
        )}
        {profile.role === 'admin' && (
          <p className="mt-6 text-sm text-ink-3">
            Admin dashboard is coming in a future iteration.
          </p>
        )}
      </div>
    </SiteShell>
  );
}
