import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { InterviewExperience } from '@/components/interview/InterviewExperience';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMemberServer, getMyInterviewServer, getMyMemberProfileServer } from '@/lib/api/server';

export const metadata = { title: 'Expert interview — GrowXQ' };

export default async function InterviewPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?returnTo=/dashboard/interview');
  if (user.role !== 'member') redirect('/dashboard');
  const [status, mine] = await Promise.all([getMyInterviewServer(), getMyMemberProfileServer()]);
  if (!status || !mine) redirect('/dashboard');
  // The results view opens the existing edit modal, which needs the owner's full profile.
  const member = status.eligibility === 'completed' ? await getMemberServer(mine.slug) : null;
  return (
    <PageContainer className="py-8 sm:py-12">
      <InterviewExperience initial={status} firstName={user.first_name} member={member} />
    </PageContainer>
  );
}
