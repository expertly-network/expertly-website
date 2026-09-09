import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { EventForm } from '@/components/admin/EventForm';

export const metadata = {
  title: 'Create event — Admin — Expertly',
};

export default async function NewAdminEventPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/events/new');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Create event</h1>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <EventForm />
        </PageContainer>
      </section>
    </div>
  );
}
