import { getCategoriesServer, getEventStatsServer, getEventsPageServer } from '@/lib/api/server';
import { toIsoDate } from '@/lib/api/events-query';
import { getSessionUser } from '@/lib/auth/session-claims';
import { canApplyForMembership } from '@/lib/auth/roles';
import { EventsHeroOrbit } from '@/components/events/EventsHeroOrbit';
import { EventsHeroSearch } from '@/components/events/EventsHeroSearch';
import { EventsList } from '@/components/events/EventsList';
import { EventsSidebar } from '@/components/events/EventsSidebar';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';

export const metadata = {
  title: 'Events — GrowXQ',
  description: 'Conferences, summits, and professional meetings curated for the GrowXQ network: in person or online.',
};

export default async function EventsPage(props: { searchParams: Promise<{ q?: string }> }) {
  // ?q= comes from the hero's keyword search and filters the list below.
  const q = (await props.searchParams).q?.trim().slice(0, 200) || undefined;
  // The match count for the default "Upcoming" filter; EventsList loads the events themselves, a
  // month at a time, from the API (the calendar is far too large to send whole).
  const from = toIsoDate(new Date());
  const [firstPage, stats, user, categories] = await Promise.all([
    getEventsPageServer({ from, q, pageSize: 1 }),
    // The sidebar's figures cover the whole calendar, not the current search.
    getEventStatsServer(),
    getSessionUser(),
    getCategoriesServer().catch(() => []),
  ]);

  return (
    <div>
      <PageHero
        eyebrow="Global Calendar"
        title={
          <>
            Be part of what&apos;s <span className="text-accent">next.</span>
          </>
        }
        lede="Conferences, summits, and professional meetings curated for the GrowXQ network: in person or online."
        search={<EventsHeroSearch initialQuery={q ?? ''} />}
        decoration={
          <>
            {/* A soft accent glow off the top-right corner, plus the orbit art (desktop only). */}
            <div
              className="pointer-events-none absolute -right-[8%] -top-[35%] h-[480px] w-[480px] rounded-full"
              style={{
                background:
                  'radial-gradient(circle, color-mix(in oklab, var(--accent) 16%, transparent) 0%, transparent 65%)',
              }}
              aria-hidden="true"
            />
            <EventsHeroOrbit />
          </>
        }
      />

      <section className="py-12">
        <PageContainer className="grid items-start gap-14 lg:grid-cols-[1fr_320px]">
          <EventsList key={q ?? ''} remote={{ total: firstPage.total }} query={q} categories={categories} />
          <div className="lg:sticky lg:top-6 lg:self-start">
            <EventsSidebar stats={stats} showApply={canApplyForMembership(user)} />
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
