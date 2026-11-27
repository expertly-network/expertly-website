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
import { PageContainer } from '@/components/layout/PageContainer';
import { SiteJsonLd } from '@/components/seo/SiteJsonLd';
import { getSessionUser } from '@/lib/auth/session-claims';
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
  // The user card's button: logged-out visitors are asked to sign in; anyone signed in goes to the directory.
  const userCta = user ? { href: '/members', label: 'Find an expert' } : { href: '/login', label: 'Sign in as a user' };
  // Second action for the hero and the member card, by who is looking.
  const growthCta =
    user?.role === 'member'
      ? { href: '/members/me', label: 'View my profile' }
      : user?.role === 'admin'
        ? { href: '/admin', label: 'Open admin panel' }
        : { href: '/apply', label: 'Apply as a member' };

  const heroAvatarUrls = members
    .map((m) => m.photoUrl)
    .filter((url): url is string => !!url)
    .slice(0, 17);

  return (
    <div>
      <SiteJsonLd />
      <StellarOrbitHero avatarUrls={heroAvatarUrls} secondaryCta={growthCta} />
      {/* The two ways in (user or member), on the hero's lower edge — shown to everyone. */}
      <DualCta userCta={userCta} growthCta={growthCta} />
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
    </div>
  );
}
