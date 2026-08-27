import {
  getMembersServer,
  getPracticeAreasServer,
  getArticlesServer,
  getEventsServer,
} from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { StellarOrbitHero } from '@/components/home/StellarOrbitHero';
import { AiSearchTeaser } from '@/components/home/AiSearchTeaser';
import { FeaturedMembers } from '@/components/home/FeaturedMembers';
import { PracticeAreasMarquee } from '@/components/home/PracticeAreasMarquee';
import { FirmsBand } from '@/components/home/FirmsBand';
import { LatestArticles } from '@/components/home/LatestArticles';
import { EventsTeaser } from '@/components/home/EventsTeaser';
import { Testimonials } from '@/components/home/Testimonials';
import { DualCta } from '@/components/home/DualCta';
import { Newsletter } from '@/components/home/Newsletter';
import { FaqGroup } from '@/components/home/Faq';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Eyebrow } from '@/components/ui';
import type { MemberListItemDto } from '@shared/member';
import type { PracticeAreaDto } from '@shared/practice-area';
import type { ArticleListItemDto } from '@shared/article';
import type { EventDto } from '@shared/event';

export const metadata = {
  title: 'Expertly — Vetted finance & legal experts, on demand',
  description:
    'A specialist network of verified senior finance and legal practitioners. Search, verify credentials, and connect directly — no agencies, no intermediaries.',
};

// Verbatim from design/static_html/index.html's FAQ section (confirmed against the actual
// rendered copy, not summarized/shortened) — 7 questions per column, not 4.
const FAQ_MEMBERSHIP = [
  {
    q: 'Who can join Expertly?',
    a: 'Expertly is open to all practising finance and legal professionals across the world. Whether you are an independent practitioner or part of a firm, if you are serious about your practice and looking for a trusted network of verified peers to collaborate, share knowledge, and grow across borders - Expertly is the right place for you.',
  },
  {
    q: 'What types of professionals are on Expertly?',
    a: 'Our network spans professionals across all finance and legal domains - including tax and transfer pricing advisors, M&A and transaction advisors, investment bankers, private equity and venture capital advisors, insolvency and restructuring professionals, corporate and commercial lawyers, dispute resolution and arbitration counsel, banking and finance lawyers, capital markets and securities lawyers, intellectual property and technology lawyers, company secretaries, compliance and governance professionals, forensic accountants, valuation experts, and cost accountants.',
  },
  {
    q: 'How are members onboarded?',
    a: 'Every member goes through a robust selection process before being onboarded and listed in the directory. We review professional credentials, years of experience, and areas of specialisation, and take feedback from fellow professionals before granting membership. The process typically takes 5 to 7 business days from application to approval.',
  },
  {
    q: 'How do I apply for membership?',
    a: "Click 'Apply for membership' on our website and complete the application form. We review all applications and notify you by email within 5 business days.",
  },
  {
    q: 'What does membership cost?',
    a: 'Membership is a flat $499/year, with zero commission on any work you win. Occasionally, we offer promotional discount codes for new members - keep an eye on our website and social media channels for such offers.',
  },
  {
    q: 'Can I publish articles on Expertly?',
    a: 'Yes - members can publish articles through the member portal. Articles are reviewed before going live and becoming visible to the public, helping you build your professional brand and reach a targeted audience of peers and potential clients.',
  },
  {
    q: 'Can firms or organisations join Expertly?',
    a: 'Membership on Expertly is individual-based, not firm-based. Each professional joins on their own merits, credentials, and experience - independent of the firm or organisation they work for. This means your profile, reputation, articles, and network on Expertly belong entirely to you. If you move firms, set up your own practice, or change roles, your membership and everything you have built on the platform remains fully intact.',
  },
];

const FAQ_CLIENTS = [
  {
    q: 'Is Expertly free to browse?',
    a: "Yes. Anyone can browse the member directory, view article headlines, and view event headlines without signing up. Full contact details of members, consultation requests, and full article and event details require registering a free account as a 'User'.",
  },
  {
    q: 'What is the difference between a User and a Member?',
    a: 'A User is a person who has created a free account on Expertly but is not a member. A User can view member contact details, place consultation requests, read full articles, and view all event details - but cannot post a profile or write articles. A Member can create a profile, be searchable on the platform, write articles, and more.',
  },
  {
    q: 'Can I request a consultation with a member?',
    a: 'Yes. Registered users and members can send consultation requests directly to any member. Members set their own availability and fee range - so you will always know exactly what to expect upfront before committing.',
  },
  {
    q: 'What does the Verified badge actually mean?',
    a: "The Verified badge is awarded only to profiles we have manually reviewed and approved. Verification covers professional credentials, qualifications, and years of experience as declared in the member's profile. If any section of a profile does not display the Verified badge, that information is either under review or has not yet been verified by the Expertly team.",
  },
  {
    q: 'How does Expertly handle complaints or concerns about a member?',
    a: "All members are required to maintain good standing with their respective professional bodies as a condition of membership. If you have a genuine concern about a member's conduct on the platform, you may submit a complaint through the platform and it will be reviewed by the Expertly compliance team. We take the integrity of our network seriously and will take appropriate action where warranted.",
  },
  {
    q: 'Are consultations handled on the platform?',
    a: 'No. Expertly acts as a discovery and connection directory. Once you connect with an expert, you schedule, agree on terms, and conduct your engagement offline or on your preferred systems directly with the practitioner.',
  },
  {
    q: 'Is my search activity private?',
    a: 'Yes. Your search queries, directory browsing, and page history are completely confidential. Members are never notified when you view their profiles or read their articles unless you choose to contact them directly.',
  },
];

// Homepage data is genuinely independent per section — one service being down (or Articles'
// table not existing yet, see docs/rest-api.md's drift note) shouldn't blank the whole page.
// allSettled + per-section empty-state (each home component already returns null on []) keeps
// the rest of the page usable instead of one failure taking down everything via error.tsx.
async function loadHomeData() {
  const [membersResult, practiceAreasResult, articlesResult, eventsResult] =
    await Promise.allSettled([
      getMembersServer(
        buildMembersQueryString({
          sort: 'featured',
          practiceAreaId: [],
          country: [],
          page: 1,
          // 20, not 16: the hero orbit (StellarOrbitHero) has 17 avatar dot slots
          // (3+4+4+6 across its 4 rings) and falls back to a plain accent-colored dot for
          // any slot beyond however many real member photos it's given — fetching fewer
          // than 17 here guarantees at least one fallback dot even when plenty of real
          // members with photos exist, which is what was happening at 16.
          pageSize: 20,
        })
      ),
      getPracticeAreasServer(),
      getArticlesServer(),
      getEventsServer(),
    ]);

  const members: MemberListItemDto[] =
    membersResult.status === 'fulfilled' ? membersResult.value : [];
  const practiceAreas: PracticeAreaDto[] =
    practiceAreasResult.status === 'fulfilled' ? practiceAreasResult.value : [];
  const articles: ArticleListItemDto[] =
    articlesResult.status === 'fulfilled' ? articlesResult.value.slice(0, 5) : [];
  const events: EventDto[] = eventsResult.status === 'fulfilled' ? eventsResult.value : [];

  return { members, practiceAreas, articles, events };
}

export default async function HomePage() {
  const { members, practiceAreas, articles, events } = await loadHomeData();

  const heroAvatarUrls = members
    .map((m) => m.photoUrl)
    .filter((url): url is string => !!url)
    .slice(0, 17);

  return (
    <div>
      <StellarOrbitHero avatarUrls={heroAvatarUrls} />
      <AiSearchTeaser members={members} articles={articles} />

      {/* Featured members — split layout, panel on the left */}
      {members.length > 0 && (
        <section className="border-b border-line py-24">
          <PageContainer className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 overflow-hidden rounded-3xl bg-bg-alt py-6 lg:order-1">
              <FeaturedMembers members={members} />
            </div>
            <div className="order-1 lg:order-2">
              <Eyebrow>Our network</Eyebrow>
              <h2 className="mt-4 text-section-title text-ink">
                A specialist network of <span className="text-accent">verified</span>{' '}
                practitioners.
              </h2>
              <p className="mt-5 text-lede text-ink-3">
                Every member is credential-verified and peer-reviewed before they join. No junior
                associates, no middlemen, just serious practitioners you can reach directly across
                every jurisdiction and practice areas.
              </p>
              <Button href="/members" className="mt-7">
                Browse all {members.length}+ members
              </Button>
            </div>
          </PageContainer>
        </section>
      )}

      {/* Practice areas — split layout, panel on the right */}
      {practiceAreas.length > 0 && (
        <section className="border-b border-line py-24">
          <PageContainer className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>Coverage</Eyebrow>
              <h2 className="mt-4 text-section-title text-ink">
                <span className="text-accent">Specialists</span> across every corner of finance
                &amp; law.
              </h2>
              <p className="mt-5 text-lede text-ink-3">
                From M&amp;A tax and transfer pricing to antitrust, capital markets, and IP, find
                a verified expert for the exact matter in front of you, in the jurisdiction that
                counts, not a generalist who&apos;s close enough.
              </p>
              <Button href="/members" className="mt-7">
                Explore all practice areas
              </Button>
            </div>
            <div className="overflow-hidden rounded-3xl bg-bg-alt py-6">
              <PracticeAreasMarquee practiceAreas={practiceAreas} />
            </div>
          </PageContainer>
        </section>
      )}

      {/* Firms band */}
      {members.length > 0 && (
        <section className="border-b border-line bg-ink py-24">
          <PageContainer>
            <Eyebrow dark>Where Our Members Practice</Eyebrow>
            <h2 className="mt-3.5 max-w-[760px] text-section-title text-bg-card">
              Senior Professionals from firms that{' '}
              <span className="text-accent">set the standard.</span>
            </h2>
            <p className="mt-4 max-w-xl text-lede text-white/60">
              From the Big Consulting firms to elite independent firms, our members are partners,
              founders, and senior professional at respected firms across 20+ jurisdictions.
            </p>
          </PageContainer>
          <div className="mt-10">
            <FirmsBand members={members} />
          </div>
        </section>
      )}

      {/* Latest articles */}
      {articles.length > 0 && (
        <section className="border-b border-line py-24">
          <PageContainer>
            <div className="flex items-end justify-between">
              <div>
                <Eyebrow>Knowledge base</Eyebrow>
                <h2 className="mt-4 text-section-title text-ink">
                  Latest <span className="text-accent">articles</span>
                </h2>
                <p className="mt-4 max-w-xl text-lede text-ink-3">
                  Thoughtful perspectives from people working through the same challenges,
                  regulations, transactions, and decisions you face every day.
                </p>
              </div>
              <Button href="/articles" variant="secondary">
                View all
              </Button>
            </div>
            <div className="mt-8">
              <LatestArticles articles={articles} />
            </div>
          </PageContainer>
        </section>
      )}

      <EventsTeaser events={events} />

      <Testimonials />

      <DualCta />
      <Newsletter />

      {/* FAQ */}
      <section className="py-24">
        <PageContainer>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-4 text-section-title text-ink">
            Common <span className="text-accent">questions</span>.
          </h2>
          <div className="mt-10 grid gap-12 lg:grid-cols-2">
            <FaqGroup title="Joining & membership" items={FAQ_MEMBERSHIP} />
            <FaqGroup title="For clients & users" items={FAQ_CLIENTS} />
          </div>
          <p className="mt-12 text-sm text-ink-3">
            Still curious? Email us at{' '}
            <a href="mailto:contact@expertly.global" className="text-accent underline">
              contact@expertly.global
            </a>
            . We reply within one business day.
          </p>
        </PageContainer>
      </section>
    </div>
  );
}
