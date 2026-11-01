import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminApplicationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { AdminApplicationsTable } from '@/components/admin/AdminApplicationsTable';

export const metadata = {
  title: 'Applications — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks permissions fresh on every request.
export default async function AdminApplicationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/applications');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const applications = await getAdminApplicationsServer();

  return (
    <div>
      <PageHero
        eyebrow="Admin"
        title="Membership applications"
        lede={
          <>
            Review submitted applications. Approving one provisions the member profile and services immediately and
            promotes the applicant&apos;s account to <code>member</code>.
          </>
        }
      />
      <section className="py-12">
        <PageContainer>
          {applications.length > 0 ? (
            <AdminApplicationsTable initialApplications={applications} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">No applications waiting for review.</p>
          )}
        </PageContainer>
      </section>
    </div>
  );
}
