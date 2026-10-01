import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminMemberEditsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { AdminMemberEditsTable } from '@/components/admin/AdminMemberEditsTable';

export const metadata = {
  title: 'Profile edits — Admin — Expertly',
};

// UX-only gate; the backend re-checks manageMembers fresh on every request.
export default async function AdminMemberEditsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/member-edits');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  // Every status, so the table can filter pending/reviewed client-side without a refetch.
  const edits = await getAdminMemberEditsServer('all');

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Profile edits</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Changes members submitted from the Edit buttons on their profile, with the proof they
            attached. Nothing goes live until it&apos;s approved here.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <AdminMemberEditsTable edits={edits} />
        </PageContainer>
      </section>
    </div>
  );
}
