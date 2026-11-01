import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminEventsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui';
import { AdminEventsList } from '@/components/admin/AdminEventsList';
import { AdminEventsImportExport } from '@/components/admin/AdminEventsImportExport';

export const metadata = {
  title: 'Events — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks permissions fresh on every request.
export default async function AdminEventsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/events');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const events = await getAdminEventsServer();

  return (
    <div>
      <PageHero
        eyebrow="Admin"
        title="Events"
        lede="Add, edit, and remove events on the community calendar. Drafts are only visible here — the public calendar only shows published events."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <AdminEventsImportExport />
            <Button href="/admin/events/new" variant="secondary-dark">
              Create event
            </Button>
          </div>
        }
      />
      <section className="py-12">
        <PageContainer>
          <AdminEventsList initialEvents={events} />
        </PageContainer>
      </section>
    </div>
  );
}
