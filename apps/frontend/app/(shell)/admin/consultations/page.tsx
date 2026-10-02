import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminConsultationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { AdminConsultationsTable } from '@/components/admin/AdminConsultationsTable';

export const metadata = {
  title: 'Consultations — Admin — Expertly',
};

// UX-only gate; the backend re-checks role + the manageConsultations permission fresh on every
// request (see AdminConsultationsController).
export default async function AdminConsultationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/consultations');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const requests = await getAdminConsultationsServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Consultations</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Who requested what, and from which member, across every member. This is visibility
            only — no contact details, message content, or actions; the member decides their own
            requests.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <AdminConsultationsTable initialRequests={requests} />
        </PageContainer>
      </section>
    </div>
  );
}
