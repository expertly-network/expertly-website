import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMyConsultationsServer, getReceivedConsultationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { ConsultationsTabs } from '@/components/consultations/ConsultationsTabs';

export const metadata = {
  title: 'Consultations — Expertly',
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
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Your account</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Consultations</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            {isMember
              ? 'Requests you’ve received through your Expertly profile, and any you’ve sent to other members.'
              : 'Every consultation request you’ve sent to a member through their Expertly profile, in one place.'}
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <ConsultationsTabs isMember={isMember} received={received} mine={mine} viewerId={profile.id} />
        </PageContainer>
      </section>
    </div>
  );
}
