import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMyApplicationServer } from '@/lib/api/server';
import { SubmittedView } from '@/components/apply/SubmittedView';
import { isSiteLaunched } from '@/lib/env';
import { homePathFor } from '@/lib/auth/roles';

export default async function ApplicationSubmittedPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/apply/submitted');
  }

  // Existing members may have been created without an application. Handle their role before
  // the missing-application redirect, otherwise /apply sends them straight back here.
  if (profile.role !== 'client') {
    if (profile.role === 'member' && !isSiteLaunched()) {
      return <SubmittedView status="approved" firstName={profile.first_name || null} prelaunch />;
    }
    redirect(homePathFor(profile.role));
  }

  const application = await getMyApplicationServer();
  if (!application || application.status === 'draft') {
    redirect('/apply');
  }

  return <SubmittedView status={application.status} firstName={application.firstName} prelaunch={!isSiteLaunched()} />;
}
