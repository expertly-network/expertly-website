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
import { Verticals } from '@/components/home/Verticals';
import { DualCta } from '@/components/home/DualCta';
import { FeaturedMembers } from '@/components/home/FeaturedMembers';
import { CategoriesMarquee } from '@/components/home/CategoriesMarquee';
import { LatestArticles } from '@/components/home/LatestArticles';
import { EventsTeaser } from '@/components/home/EventsTeaser';
import { Newsletter } from '@/components/home/Newsletter';
import { HomeFaq } from '@/components/home/Faq';
import { PageContainer } from '@/components/layout/PageContainer';
import { SiteJsonLd } from '@/components/seo/SiteJsonLd';
import { getSessionUser } from '@/lib/auth/session-claims';
import { canApplyForMembership } from '@/lib/auth/roles';
import { MobileViewAll } from '@/components/home/MobileViewAll';
import { Button, Eyebrow } from '@/components/ui';
import { OG_IMAGE_SRC } from '@/lib/brand';
import type { MemberListItemDto } from '@shared/member';
import type { CategoryDto } from '@shared/category';
import type { ArticleListItemDto } from '@shared/article';

export const metadata = {
  title: 'GrowXQ: the growth platform for independent and mid-size finance and tax firms',
  description:
    'Trusted AI tools, practical training and a global network, so a small finance or tax practice gets the capability of a big one. Become a member.',
  alternates: { canonical: '/' },
  // A route that sets openGraph replaces the layout's whole object, so images are repeated here.
  openGraph: {
    siteName: 'GrowXQ',
    type: 'website',
    url: '/',
    title: 'GrowXQ: the growth platform for independent and mid-size finance and tax firms',
    description:
      'Trusted AI tools, practical training and a global network, so a small practice gets the capability of a big one.',
    images: [{ url: OG_IMAGE_SRC, width: 1200, height: 630, alt: 'GrowXQ' }],
  },
};

const FAQ_MEMBERSHIP = [
  {
    q: 'What is GrowXQ?',
    a: 'GrowXQ is a growth platform for independent practitioners and mid-size firms in finance and tax. It brings together AI tools we review for you, practical training, reach and a global network, so a small practice gets the capability of a big one. Some parts are live today and others are on the way, and each is marked with its status. We disclose every vendor relationship.',
  },
  {
    q: 'Why trust a new platform?',
    a: 'We disclose every vendor relationship. Members decide what gets listed. Nothing is marked live until it is.',
  },
  {
    q: 'What does membership cost?',
    a: 'Membership is a flat $699/year, with zero commission on any work you win. Occasionally, we offer promotional discount codes for new members - keep an eye on our website and social media channels for such offers.',
  },
  {
    q: 'Who can join GrowXQ?',
    a: "GrowXQ is open to practising finance and tax professionals across the world with at least five years of experience (applications below that are not accepted). Law professionals can also apply. Members with 5 to 12 years join as Budding Professionals and those with more than 12 as Seasoned Professionals; our team confirms the tier on the strength of each member's experience and work.",
  },
  {
    q: 'What types of professionals are on GrowXQ?',
    a: 'Members come from tax, M&A, transfer pricing, restructuring and related finance disciplines.',
  },
  {
    q: 'How are members onboarded?',
    a: 'Every member goes through a selection process before being onboarded and listed in the directory. We review professional credentials, years of experience, and areas of specialisation, and take feedback from fellow professionals before granting membership. The process typically takes 5 to 7 business days from application to approval.',
  },
  {
    q: 'How do I apply for membership?',
    a: "Click 'Apply for membership' on our website and complete the application form. We review all applications and notify you by email within 5 business days.",
  },
  {
    q: 'Can I publish articles on GrowXQ?',
    a: 'Yes - members can publish articles through the member portal. Articles are reviewed before going live and becoming visible to the public, helping you build your professional brand and reach a targeted audience of peers and potential clients.',
  },
  {
    q: 'Can firms or organisations join GrowXQ?',
    a: 'Membership on GrowXQ is individual-based, not firm-based. Each professional joins on their own merits, credentials, and experience - independent of the firm or organisation they work for. This means your profile, reputation, articles, and network on GrowXQ belong entirely to you. If you move firms, set up your own practice, or change roles, your membership and everything you have built on the platform stays with you.',
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
    <section className={`border-b border-line py-10 sm:py-24 ${dark ? 'bg-ink' : ''}`} aria-busy="true">
      <PageContainer className="grid animate-pulse gap-6 sm:gap-12 lg:grid-cols-2 lg:items-center">
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

// Hidden on the homepage for now (2026-11-23); flip to true to bring the section back.
const SHOW_CATEGORIES = false;

async function CategoriesSection() {
  let categories: CategoryDto[];
  try {
    categories = await getCategoriesServer();
  } catch {
    return null;
  }
  if (categories.length === 0) return null;
  return (
    <section className="border-b border-line py-10 sm:py-24">
      <PageContainer className="grid gap-6 sm:gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Coverage</Eyebrow>
          <h2 className="font-brand mt-4 text-section-title text-ink">
            <span className="text-accent">Specialists</span> across every corner of finance and tax.
          </h2>
          <p className="mt-4 text-lede text-ink-3 sm:mt-5">
            From M&amp;A tax and transfer pricing to valuation, compliance, and capital markets, find a verified peer
            for your matter, in the right jurisdiction.
          </p>
          <Button href="/members" className="mt-6 sm:mt-7">
            Explore all categories
          </Button>
        </div>
        <div className="-mx-5 overflow-hidden bg-bg-alt py-4 sm:mx-0 sm:rounded-3xl sm:py-6">
          <CategoriesMarquee categories={categories} />
        </div>
      </PageContainer>
    </section>
  );
}

async function LatestArticlesSection() {
  let articles: ArticleListItemDto[];
  try {
    articles = (await getArticlesServer({ pageSize: 6 })).items;
  } catch {
    return null;
  }
  if (articles.length === 0) return null;
  return (
    <section className="border-b border-line py-10 sm:py-24">
      <PageContainer>
        <div className="flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Knowledge base</Eyebrow>
            <h2 className="font-brand mt-4 text-section-title text-ink">
              Latest <span className="text-accent">articles</span>
            </h2>
            <p className="mt-4 hidden max-w-xl text-lede text-ink-3 sm:block">
              Articles by members on tax, M&A, compliance and more.
            </p>
          </div>
          <MobileViewAll href="/articles" />
          <Button href="/articles" variant="secondary" className="hidden sm:inline-flex">
            View all
          </Button>
        </div>
        <div className="mt-5 sm:mt-8">
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
      <SiteJsonLd />
      <StellarOrbitHero avatarUrls={heroAvatarUrls} showApply={showApply} showMyProfile={user?.role === 'member'} />
      {/* The two ways in (user or member), on the hero's lower edge. */}
      {showApply && <DualCta />}
      <Verticals />

      {/* Featured members — split layout, panel on the left */}
      {members.length > 0 && (
        <section className="border-b border-line py-10 sm:py-24">
          <PageContainer className="grid gap-6 sm:gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 -mx-5 overflow-hidden bg-bg-alt py-4 sm:mx-0 sm:rounded-3xl sm:py-6 lg:order-1">
              <FeaturedMembers members={members} />
            </div>
            <div className="order-1 lg:order-2">
              <Eyebrow>Our network</Eyebrow>
              <h2 className="font-brand mt-4 text-section-title text-ink">
                <span className="text-accent">Verified</span> practitioners, reviewed before they join.
              </h2>
              <p className="mt-4 text-lede text-ink-3 sm:mt-5">
                Members are reviewed before they join. Independent practitioners and mid-size firm professionals,
                reachable directly across borders.
              </p>
              <Button href="/members" className="mt-6 sm:mt-7">
                {/* Not "{n}+ members": `members` is a capped featured page, not the directory size. */}
                Browse all members
              </Button>
            </div>
          </PageContainer>
        </section>
      )}

      {/* Categories ("Specialists across every corner…") — hidden from the homepage for now; kept so it
          can be switched back on by flipping SHOW_CATEGORIES. */}
      {SHOW_CATEGORIES && (
        <Suspense fallback={<SectionSkeleton />}>
          <CategoriesSection />
        </Suspense>
      )}

      {/* Latest articles */}
      <Suspense fallback={<SectionSkeleton />}>
        <LatestArticlesSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <EventsSection />
      </Suspense>

      <Newsletter />

      {/* FAQ */}
      <section className="border-b border-line py-10 sm:py-24">
        <PageContainer>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="font-brand mt-4 text-section-title text-ink">
            Common <span className="text-accent">questions</span>.
          </h2>
          <HomeFaq membership={FAQ_MEMBERSHIP} clients={FAQ_CLIENTS} />
          <p className="mt-6 text-sm text-ink-3 sm:mt-12">
            Still curious? Email us at{' '}
            <a href="mailto:ask@growxq.com" className="text-accent underline">
              ask@growxq.com
            </a>
            . We reply within one business day.
          </p>
        </PageContainer>
      </section>
    </div>
  );
}
