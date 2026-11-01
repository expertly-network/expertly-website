import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminMemberEditsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { AdminMemberEditsTable } from '@/components/admin/AdminMemberEditsTable';

export const metadata = {
  title: 'Profile edits — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks manageMembers fresh on every request.
export default async function AdminMemberEditsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/member-edits');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  // Every status, so the table can filter pending/reviewed client-side without a refetch.
  const edits = await getAdminMemberEditsServer('all');

  return (
    <div>
      <PageHero
        eyebrow="Admin"
        title="Profile edits"
        lede="Changes members submitted from the Edit buttons on their profile, with the proof they attached. Nothing goes live until it’s approved here."
      />
      <section className="py-12">
        <PageContainer>
          <AdminMemberEditsTable edits={edits} />
        </PageContainer>
      </section>
    </div>
  );
}
