import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { EventForm } from '@/components/admin/EventForm';
import { getCategoriesServer } from '@/lib/api/server';

export const metadata = {
  title: 'Create event — Admin — GrowXQ',
};

export default async function NewAdminEventPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/events/new');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  return (
    <div>
      <PageHero eyebrow="Admin" title="Create event" />
      <section className="py-12">
        <PageContainer>
          <EventForm categories={await getCategoriesServer()} />
        </PageContainer>
      </section>
    </div>
  );
}
