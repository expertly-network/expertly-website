import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMyConsultationsServer, getReceivedConsultationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { ConsultationsTabs } from '@/components/consultations/ConsultationsTabs';

export const metadata = {
  title: 'Consultations — GrowXQ',
};

export default async function ConsultationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/consultations');
  }

  const isMember = profile.role === 'member';
  const [mine, received] = await Promise.all([
    getMyConsultationsServer(),
    isMember ? getReceivedConsultationsServer() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHero
        eyebrow="Your account"
        title={
          <>
            Your <span className="text-accent">consultations.</span>
          </>
        }
        lede={
          isMember
            ? 'Requests you’ve received through your GrowXQ profile, and any you’ve sent to other members.'
            : 'Every consultation request you’ve sent to a member through their GrowXQ profile, in one place.'
        }
      />
      <section className="py-12">
        <PageContainer>
          <ConsultationsTabs isMember={isMember} received={received} mine={mine} viewerId={profile.id} />
        </PageContainer>
      </section>
    </div>
  );
}
