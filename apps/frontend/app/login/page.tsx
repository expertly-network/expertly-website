import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { safeReturnTo } from '@/lib/auth/return-to';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthLayout } from '@/components/auth/AuthLayout';
import type { AuthMode } from '@/components/auth/AuthTabs';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { mode?: string; returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams.returnTo);
  const profile = await getSessionUser();
  if (profile) {
    redirect(returnTo);
  }

  const initialMode: AuthMode = searchParams.mode === 'member' ? 'member' : 'user';

  return (
    <AuthLayout>
      <AuthCard initialMode={initialMode} returnTo={returnTo} />
    </AuthLayout>
  );
}
