import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminEventServer, getCategoriesServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { EventForm } from '@/components/admin/EventForm';

export const metadata = {
  title: 'Edit event — Admin — GrowXQ',
};

export default async function EditAdminEventPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/events/${params.id}/edit`);
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const event = await getAdminEventServer(params.id);
  if (!event) {
    notFound();
  }

  return (
    <div>
      <PageHero eyebrow="Admin" title="Edit event" />
      <section className="py-12">
        <PageContainer>
          <EventForm event={event} categories={await getCategoriesServer()} />
        </PageContainer>
      </section>
    </div>
  );
}
