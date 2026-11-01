import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMyApplicationServer } from '@/lib/api/server';
import { SubmittedView } from '@/components/apply/SubmittedView';
import { isSiteLaunched } from '@/lib/env';

export default async function ApplicationSubmittedPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/apply/submitted');
  }

  const application = await getMyApplicationServer();
  if (!application) {
    redirect('/apply');
  }

  return <SubmittedView status={application.status} firstName={application.firstName} prelaunch={!isSiteLaunched()} />;
}
