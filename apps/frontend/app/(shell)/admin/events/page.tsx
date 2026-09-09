import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminEventsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Eyebrow } from '@/components/ui';
import { AdminEventsList } from '@/components/admin/AdminEventsList';

export const metadata = {
  title: 'Events — Admin — Expertly',
};

// UX-only gate — the real authorization boundary is the backend's @Roles('admin') +
// @RequiresPermission('manageEvents') guard chain (docs/auth.md), re-checked fresh against the
// DB on every request, not trusted from this JWT-derived role. Matches
// app/(shell)/admin/applications/page.tsx exactly.
export default async function AdminEventsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/events');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const events = await getAdminEventsServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <Eyebrow dark>Admin</Eyebrow>
              <h1 className="mt-2 text-headline text-bg-card">Events</h1>
              <p className="mt-3 max-w-xl text-lede text-white/65">
                Add, edit, and remove events on the community calendar. Drafts are only visible
                here — the public calendar only shows published events.
              </p>
            </div>
            <Button href="/admin/events/new" variant="secondary-dark">
              Create event
            </Button>
          </div>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <AdminEventsList initialEvents={events} />
        </PageContainer>
      </section>
    </div>
  );
}
