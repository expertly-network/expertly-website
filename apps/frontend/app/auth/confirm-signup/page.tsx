import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ConfirmSignupCard } from '@/components/auth/ConfirmSignupCard';

// Reached only from app/auth/callback/route.ts, right after a LinkedIn sign-in
// (User tab's "Sign in" view, or the Member tab) turned out to have created a
// brand-new account — see that file's comment for why this couldn't be asked
// before the account existed. If there's no session (e.g. a stale bookmark
// after signing out), there's nothing to confirm — send them to /login.
export default async function ConfirmSignupPage({
  searchParams,
}: {
  searchParams: { destination?: string };
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }

  const destination = searchParams.destination ?? '/';

  return (
    <AuthLayout>
      <ConfirmSignupCard destination={destination} />
    </AuthLayout>
  );
}
