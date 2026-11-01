import { Suspense } from 'react';
import {
  getMembersServer,
  getCategoriesServer,
  getArticlesServer,
  getEventCalendarServer,
  getEventsPageServer,
} from '@/lib/api/server';
import { toIsoDate } from '@/lib/api/events-query';
import { buildMembersQueryString } from '@/lib/api/members';
import { StellarOrbitHero } from '@/components/home/StellarOrbitHero';
import { AiSearchTeaser } from '@/components/home/AiSearchTeaser';
import { FeaturedMembers } from '@/components/home/FeaturedMembers';
import { CategoriesMarquee } from '@/components/home/CategoriesMarquee';
import { FirmsBand } from '@/components/home/FirmsBand';
import { LatestArticles } from '@/components/home/LatestArticles';
import { EventsTeaser } from '@/components/home/EventsTeaser';
import { Testimonials } from '@/components/home/Testimonials';
import { DualCta } from '@/components/home/DualCta';
import { Newsletter } from '@/components/home/Newsletter';
import { FaqGroup } from '@/components/home/Faq';
import { PageContainer } from '@/components/layout/PageContainer';
import { getSessionUser } from '@/lib/auth/session-claims';
import { canApplyForMembership } from '@/lib/auth/roles';
import { Button, Eyebrow } from '@/components/ui';
import type { MemberListItemDto } from '@shared/member';
import type { CategoryDto } from '@shared/category';
import type { ArticleListItemDto } from '@shared/article';

export const metadata = {
  title: 'GrowXQ — Vetted finance & legal experts, on demand',
  description:
    'A specialist network of verified senior finance and legal practitioners. Search, verify credentials, and connect directly — no agencies, no intermediaries.',
};

const FAQ_MEMBERSHIP = [
  {
    q: 'Who can join GrowXQ?',
    a: 'GrowXQ is open to all practising finance and legal professionals across the world. Whether you are an independent practitioner or part of a firm, if you are serious about your practice and looking for a trusted network of verified peers to collaborate, share knowledge, and grow across borders - GrowXQ is the right place for you.',
  },
  {
    q: 'What types of professionals are on GrowXQ?',
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
    q: 'Can I publish articles on GrowXQ?',
    a: 'Yes - members can publish articles through the member portal. Articles are reviewed before going live and becoming visible to the public, helping you build your professional brand and reach a targeted audience of peers and potential clients.',
  },
  {
    q: 'Can firms or organisations join GrowXQ?',
    a: 'Membership on GrowXQ is individual-based, not firm-based. Each professional joins on their own merits, credentials, and experience - independent of the firm or organisation they work for. This means your profile, reputation, articles, and network on GrowXQ belong entirely to you. If you move firms, set up your own practice, or change roles, your membership and everything you have built on the platform remains fully intact.',
  },
];

const FAQ_CLIENTS = [
  {
    q: 'Is GrowXQ free to browse?',
    a: "Yes. Anyone can browse the member directory, view article headlines, and view event headlines without signing up. Full contact details of members, consultation requests, and full article and event details require registering a free account as a 'User'.",
  },
  {
    q: 'What is the difference between a User and a Member?',
    a: 'A User is a person who has created a free account on GrowXQ but is not a member. A User can view member contact details, place consultation requests, read full articles, and view all event details - but cannot post a profile or write articles. A Member can create a profile, be searchable on the platform, write articles, and more.',
  },
  {
    q: 'Can I request a consultation with a member?',
    a: 'Yes. Registered users and members can send consultation requests directly to any member. Members set their own availability and fee range - so you will always know exactly what to expect upfront before committing.',
  },
  {
    q: 'What does the Verified badge actually mean?',
    a: "The Verified badge is awarded only to profiles we have manually reviewed and approved. Verification covers professional credentials, qualifications, and years of experience as declared in the member's profile. If any section of a profile does not display the Verified badge, that information is either under review or has not yet been verified by the GrowXQ team.",
  },
  {
    q: 'How does GrowXQ handle complaints or concerns about a member?',
    a: "All members are required to maintain good standing with their respective professional bodies as a condition of membership. If you have a genuine concern about a member's conduct on the platform, you may submit a complaint through the platform and it will be reviewed by the GrowXQ compliance team. We take the integrity of our network seriously and will take appropriate action where warranted.",
  },
  {
    q: 'Are consultations handled on the platform?',
    a: 'No. GrowXQ acts as a discovery and connection directory. Once you connect with an expert, you schedule, agree on terms, and conduct your engagement offline or on your preferred systems directly with the practitioner.',
  },
  {
    q: 'Is my search activity private?',
    a: 'Yes. Your search queries, directory browsing, and page history are completely confidential. Members are never notified when you view their profiles or read their articles unless you choose to contact them directly.',
  },
];

// Each data-backed section is its own async Server Component inside a Suspense boundary, so the
// page streams: the hero (which needs the featured members for its avatar orbit) renders first,
// and the categories / articles / events sections fill in as each request returns. A failing
// request hides only its own section, never the whole page.
async function loadFeaturedMembers(): Promise<MemberListItemDto[]> {
  try {
    return await getMembersServer(
      buildMembersQueryString({
        sort: 'featured',
        serviceId: [],
        country: [],
        page: 1,
        // Covers the hero orbit's 17 avatar slots.
        pageSize: 20,
      })
    );
  } catch {
    return [];
  }
}

// Stand-in for a split (copy + panel) section while its data streams in.
function SectionSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <section className={`border-b border-line py-24 ${dark ? 'bg-ink' : ''}`} aria-busy="true">
      <PageContainer className="grid animate-pulse gap-12 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-4">
          <div className={`h-3 w-28 rounded ${dark ? 'bg-white/10' : 'bg-bg-alt'}`} />
          <div className={`h-10 w-4/5 rounded-md ${dark ? 'bg-white/10' : 'bg-bg-alt'}`} />
          <div className={`h-4 w-full rounded-md ${dark ? 'bg-white/10' : 'bg-bg-alt'}`} />
          <div className={`h-4 w-2/3 rounded-md ${dark ? 'bg-white/10' : 'bg-bg-alt'}`} />
        </div>
        <div className={`h-56 rounded-3xl ${dark ? 'bg-white/10' : 'bg-bg-alt'}`} />
      </PageContainer>
    </section>
  );
}

async function CategoriesSection() {
  let categories: CategoryDto[];
  try {
    categories = await getCategoriesServer();
  } catch {
    return null;
  }
  if (categories.length === 0) return null;
  return (
    <section className="border-b border-line py-24">
      <PageContainer className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Coverage</Eyebrow>
          <h2 className="font-brand mt-4 text-section-title text-ink">
            <span className="text-accent">Specialists</span> across every corner of finance &amp; law.
          </h2>
          <p className="mt-5 text-lede text-ink-3">
            From M&amp;A tax and transfer pricing to antitrust, capital markets, and IP, find a verified expert for the
            exact matter in front of you, in the jurisdiction that counts, not a generalist who&apos;s close enough.
          </p>
          <Button href="/members" className="mt-7">
            Explore all categories
          </Button>
        </div>
        <div className="overflow-hidden rounded-3xl bg-bg-alt py-6">
          <CategoriesMarquee categories={categories} />
        </div>
      </PageContainer>
    </section>
  );
}

async function LatestArticlesSection() {
  let articles: ArticleListItemDto[];
  try {
    articles = (await getArticlesServer({ pageSize: 5 })).items;
  } catch {
    return null;
  }
  if (articles.length === 0) return null;
  return (
    <section className="border-b border-line py-24">
      <PageContainer>
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>Knowledge base</Eyebrow>
            <h2 className="font-brand mt-4 text-section-title text-ink">
              Latest <span className="text-accent">articles</span>
            </h2>
            <p className="mt-4 max-w-xl text-lede text-ink-3">
              Thoughtful perspectives from people working through the same challenges, regulations, transactions, and
              decisions you face every day.
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
  );
}

async function EventsSection() {
  // The current month's calendar (per-day counts + two events a day) and the next few events for
  // the phone-width list; other months load as the visitor navigates.
  const now = new Date();
  const [calendar, upcoming] = await Promise.all([
    getEventCalendarServer(
      toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    ).catch(() => ({ days: [] })),
    getEventsPageServer({ from: toIsoDate(now), pageSize: 4 })
      .then((p) => p.items)
      .catch(() => []),
  ]);
  return <EventsTeaser calendar={calendar} upcoming={upcoming} />;
}

export default async function HomePage() {
  const [members, user] = await Promise.all([loadFeaturedMembers(), getSessionUser()]);
  const showApply = canApplyForMembership(user);

  const heroAvatarUrls = members
    .map((m) => m.photoUrl)
    .filter((url): url is string => !!url)
    .slice(0, 17);

  return (
    <div>
      <StellarOrbitHero avatarUrls={heroAvatarUrls} showApply={showApply} showMyProfile={user?.role === 'member'} />
      <AiSearchTeaser />

      {/* Featured members — split layout, panel on the left */}
      {members.length > 0 && (
        <section className="border-b border-line py-24">
          <PageContainer className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 overflow-hidden rounded-3xl bg-bg-alt py-6 lg:order-1">
              <FeaturedMembers members={members} />
            </div>
            <div className="order-1 lg:order-2">
              <Eyebrow>Our network</Eyebrow>
              <h2 className="font-brand mt-4 text-section-title text-ink">
                A specialist network of <span className="text-accent">verified</span> practitioners.
              </h2>
              <p className="mt-5 text-lede text-ink-3">
                Every member is credential-verified and peer-reviewed before they join. No junior associates, no
                middlemen, just serious practitioners you can reach directly across every jurisdiction and practice
                areas.
              </p>
              <Button href="/members" className="mt-7">
                {/* Not "{n}+ members": `members` is a capped featured page, not the directory size. */}
                Browse all members
              </Button>
            </div>
          </PageContainer>
        </section>
      )}

      {/* Categories — split layout, panel on the right */}
      <Suspense fallback={<SectionSkeleton />}>
        <CategoriesSection />
      </Suspense>

      {/* Firms band */}
      {members.length > 0 && (
        <section className="border-b border-line bg-ink py-24">
          <PageContainer>
            <Eyebrow dark>Where Our Members Practice</Eyebrow>
            <h2 className="font-brand mt-3.5 max-w-[760px] text-section-title text-bg-card">
              Senior Professionals from firms that <span className="text-accent">set the standard.</span>
            </h2>
            <p className="mt-4 max-w-xl text-lede text-white/60">
              From the Big Consulting firms to elite independent firms, our members are partners, founders, and senior
              professional at respected firms across 20+ jurisdictions.
            </p>
          </PageContainer>
          <div className="mt-10">
            <FirmsBand members={members} />
          </div>
        </section>
      )}

      {/* Latest articles */}
      <Suspense fallback={<SectionSkeleton />}>
        <LatestArticlesSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <EventsSection />
      </Suspense>

      <Testimonials />

      <DualCta />
      <Newsletter />

      {/* FAQ */}
      <section className="py-24">
        <PageContainer>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="font-brand mt-4 text-section-title text-ink">
            Common <span className="text-accent">questions</span>.
          </h2>
          <div className="mt-10 grid gap-12 lg:grid-cols-2">
            <FaqGroup title="Joining & membership" items={FAQ_MEMBERSHIP} />
            <FaqGroup title="For clients & users" items={FAQ_CLIENTS} />
          </div>
          <p className="mt-12 text-sm text-ink-3">
            Still curious? Email us at{' '}
            <a href="mailto:contact@growxq.com" className="text-accent underline">
              contact@growxq.com
            </a>
            . We reply within one business day.
          </p>
        </PageContainer>
      </section>
    </div>
  );
}
