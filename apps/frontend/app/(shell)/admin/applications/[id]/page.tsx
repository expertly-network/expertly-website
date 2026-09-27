import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminApplicationServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { ApplicationReviewDetail } from '@/components/admin/ApplicationReviewDetail';

export const metadata = {
  title: 'Review application — Admin — Expertly',
};

export default async function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/applications/${params.id}`);
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const application = await getAdminApplicationServer(params.id);
  if (!application) {
    notFound();
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Membership Application</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">Review this membership application.</p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <ApplicationReviewDetail application={application} />
        </PageContainer>
      </section>
    </div>
  );
}
