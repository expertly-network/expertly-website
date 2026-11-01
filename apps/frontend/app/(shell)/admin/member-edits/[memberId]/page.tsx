import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminMemberEditsDetailServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero, HeroBackLink } from '@/components/layout/PageHero';
import { MemberEditsReview } from '@/components/admin/MemberEditsReview';

export const metadata = {
  title: 'Review profile edits — Admin — GrowXQ',
};

export default async function AdminMemberEditsDetailPage(props: { params: Promise<{ memberId: string }> }) {
  const params = await props.params;
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/member-edits/${params.memberId}`);
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const detail = await getAdminMemberEditsDetailServer(params.memberId);
  if (!detail) {
    notFound();
  }

  return (
    <div>
      <PageHero
        back={<HeroBackLink href="/admin/member-edits">All profile edits</HeroBackLink>}
        eyebrow="Admin · Profile edits"
        title={detail.member.name}
        lede="Compare each proposed section with what’s live now, check the proof, then approve or reject it."
      />
      <section className="py-12">
        <PageContainer>
          <MemberEditsReview detail={detail} />
        </PageContainer>
      </section>
    </div>
  );
}
