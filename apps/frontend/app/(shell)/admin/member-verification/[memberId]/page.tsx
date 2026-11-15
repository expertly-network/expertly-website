import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminMemberVerificationServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero, HeroBackLink } from '@/components/layout/PageHero';
import { MemberVerification } from '@/components/admin/MemberVerification';

export const metadata = {
  title: 'Verify profile — Admin — GrowXQ',
};

export default async function AdminMemberVerificationDetailPage(props: { params: Promise<{ memberId: string }> }) {
  const params = await props.params;
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/member-verification/${params.memberId}`);
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const detail = await getAdminMemberVerificationServer(params.memberId);
  if (!detail) {
    notFound();
  }

  return (
    <div>
      <PageHero
        back={<HeroBackLink href="/admin/member-verification">All profile verification</HeroBackLink>}
        eyebrow="Admin · Profile verification"
        title={detail.member.name}
        lede="Everything below is already live on the profile. Check each pending entry against its proof and verify what holds up."
      />
      <section className="py-12">
        <PageContainer>
          <MemberVerification detail={detail} />
        </PageContainer>
      </section>
    </div>
  );
}
