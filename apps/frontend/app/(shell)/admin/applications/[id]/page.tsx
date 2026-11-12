import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminApplicationServer, getCategoriesServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { ApplicationReviewDetail } from '@/components/admin/ApplicationReviewDetail';

export const metadata = {
  title: 'Review application — Admin — GrowXQ',
};

export default async function AdminApplicationDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/applications/${params.id}`);
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const [application, categories] = await Promise.all([getAdminApplicationServer(params.id), getCategoriesServer()]);
  if (!application) {
    notFound();
  }

  return (
    <div>
      <PageHero eyebrow="Admin" title="Membership Application" lede="Review this membership application." />
      <section className="py-12">
        <PageContainer>
          <ApplicationReviewDetail application={application} categories={categories} />
        </PageContainer>
      </section>
    </div>
  );
}
