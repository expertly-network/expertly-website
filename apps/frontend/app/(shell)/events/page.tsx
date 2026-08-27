import { getArticlesServer, getEventsServer, getMembersServer } from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { EventsHeroSearch } from '@/components/events/EventsHeroSearch';
import { EventsList } from '@/components/events/EventsList';
import { EventsSidebar } from '@/components/events/EventsSidebar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';

export const metadata = {
  title: 'Events — Expertly',
  description:
    'Conferences, summits, and professional meetings curated for the Expertly network: in person, hybrid, or on-demand.',
};

export default async function EventsPage() {
  const [events, members, articles] = await Promise.all([
    getEventsServer({ upcoming: false }),
    getMembersServer(
      buildMembersQueryString({ sort: 'featured', practiceAreaId: [], country: [], page: 1, pageSize: 50 })
    ),
    getArticlesServer(),
  ]);

  return (
    <div>
      <section className="relative overflow-hidden bg-ink py-16">
        {/* Matches design's `.env-hero::before` — a soft accent-tinted glow bleeding off the
            top-right corner. This was completely flat `--ink` before, which is what read as
            "bolder/blackish" compared to the design — every other dark hero/card in this app
            already has this same treatment (DualCta, Newsletter, ArticleNewsletterCard, the
            homepage's stellar hero), this page's own hero was the one still missing it. */}
        <div
          className="pointer-events-none absolute -right-[8%] -top-[35%] h-[480px] w-[480px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,165,130,0.16) 0%, transparent 65%)' }}
          aria-hidden="true"
        />
        <PageContainer className="relative">
          <Eyebrow dark>Global Calendar</Eyebrow>
          {/* `.env-hero-heading`'s own clamp(30px,3.8vw,50px) — smaller top-end than the shared
              `text-headline` token (up to 56px), which is why this heading previously read as
              heavier than the design at wide viewports. */}
          <h1 className="mt-[18px] text-[clamp(30px,3.8vw,50px)] font-medium leading-[1.04] tracking-[-0.03em] text-bg-card">
            Be part of what&apos;s <span className="text-accent">next.</span>
          </h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Conferences, summits, and professional meetings curated for the Expertly network: in
            person, hybrid, or on-demand.
          </p>
          <EventsHeroSearch members={members} articles={articles} events={events} />
        </PageContainer>
      </section>

      <section className="py-12">
        <PageContainer className="grid items-start gap-14 lg:grid-cols-[1fr_320px]">
          <EventsList events={events} />
          <div className="lg:sticky lg:top-6 lg:self-start">
            <EventsSidebar />
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
