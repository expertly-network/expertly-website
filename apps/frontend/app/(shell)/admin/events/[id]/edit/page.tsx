import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminEventServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { EventForm } from '@/components/admin/EventForm';

export const metadata = {
  title: 'Edit event — Admin — Expertly',
};

export default async function EditAdminEventPage({ params }: { params: { id: string } }) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/events/${params.id}/edit`);
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const event = await getAdminEventServer(params.id);
  if (!event) {
    notFound();
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Edit event</h1>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <EventForm event={event} />
        </PageContainer>
      </section>
    </div>
  );
}
