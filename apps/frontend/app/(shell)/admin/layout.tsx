import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';

// Role gate for every /admin route, so a new admin page can't ship without one. Each page keeps its
// own check too (defense in depth — and it knows its own returnTo path); the backend re-checks
// profiles.role on every admin endpoint regardless. Signed-out visitors normally never get here:
// middleware.ts already redirects them to /login with the exact path.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }
  return <>{children}</>;
}
