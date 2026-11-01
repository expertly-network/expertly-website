import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminConsultationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { AdminConsultationsTable } from '@/components/admin/AdminConsultationsTable';

export const metadata = {
  title: 'Consultations — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks role + the manageConsultations permission fresh on every
// request (see AdminConsultationsController).
export default async function AdminConsultationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/consultations');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const requests = await getAdminConsultationsServer();

  return (
    <div>
      <PageHero
        eyebrow="Admin"
        title="Consultations"
        lede="Who requested what, and from which member, across every member. This is visibility only — no contact details, message content, or actions; the member decides their own requests."
      />
      <section className="py-12">
        <PageContainer>
          <AdminConsultationsTable initialRequests={requests} />
        </PageContainer>
      </section>
    </div>
  );
}
