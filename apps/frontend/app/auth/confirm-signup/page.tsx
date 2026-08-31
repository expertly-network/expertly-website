import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ConfirmSignupCard } from '@/components/auth/ConfirmSignupCard';

// The universal consent gate — middleware.ts redirects here for any signed-in request whose JWT
// doesn't carry consent_given=true, from any route, regardless of signup path. If there's no
// session at all (e.g. a stale bookmark after signing out), there's nothing to confirm — send
// them to /login.
export default async function ConfirmSignupPage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }

  const destination = searchParams.returnTo ?? '/';

  return (
    <AuthLayout>
      <ConfirmSignupCard destination={destination} />
    </AuthLayout>
  );
}
