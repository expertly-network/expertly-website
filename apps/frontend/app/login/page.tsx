import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { safeReturnTo } from '@/lib/auth/return-to';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { InviteOnlyAuthCard } from '@/components/auth/InviteOnlyAuthCard';
import { isSiteLaunched } from '@/lib/env';
import type { AuthMode } from '@/components/auth/AuthTabs';

export default async function LoginPage(props: { searchParams: Promise<{ mode?: string; returnTo?: string }> }) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams.returnTo);
  const profile = await getSessionUser();
  if (profile) {
    redirect(returnTo);
  }

  if (!isSiteLaunched()) {
    return (
      <AuthLayout>
        <InviteOnlyAuthCard returnTo={returnTo} emailSignIn={searchParams.mode === 'email'} />
      </AuthLayout>
    );
  }

  const initialMode: AuthMode = searchParams.mode === 'member' ? 'member' : 'user';

  return (
    <AuthLayout>
      <AuthCard initialMode={initialMode} returnTo={returnTo} />
    </AuthLayout>
  );
}
