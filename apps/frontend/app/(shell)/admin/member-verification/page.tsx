import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminVerificationSummaryServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { AdminVerificationTable } from '@/components/admin/AdminVerificationTable';

export const metadata = {
  title: 'Profile verification — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks manageMembers fresh on every request.
export default async function AdminMemberVerificationPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/member-verification');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const members = await getAdminVerificationSummaryServer();

  return (
    <div>
      <PageHero
        eyebrow="Admin"
        title="Profile verification"
        lede="Members’ edits go live straight away. Start with “To review”, check each entry against its proof and verify what holds up."
      />
      <section className="py-12">
        <PageContainer>
          <AdminVerificationTable members={members} />
        </PageContainer>
      </section>
    </div>
  );
}
