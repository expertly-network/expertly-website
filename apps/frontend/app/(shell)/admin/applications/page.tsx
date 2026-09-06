import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminApplicationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { AdminApplicationsTable } from '@/components/admin/AdminApplicationsTable';

export const metadata = {
  title: 'Applications — Admin — Expertly',
};

// UX-only gate — the real authorization boundary is the backend's @Roles('admin') +
// @RequiresPermission('manageApplications') guard chain (docs/auth.md), re-checked fresh
// against the DB on every request, not trusted from this JWT-derived role.
export default async function AdminApplicationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/applications');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const applications = await getAdminApplicationsServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Membership applications</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Review submitted applications. Approving one provisions the member profile and
            services immediately and promotes the applicant's account to <code>member</code>.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          {applications.length > 0 ? (
            <AdminApplicationsTable initialApplications={applications} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">
              No applications waiting for review.
            </p>
          )}
        </PageContainer>
      </section>
    </div>
  );
}
