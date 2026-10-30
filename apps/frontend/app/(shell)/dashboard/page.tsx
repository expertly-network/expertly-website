import Link from 'next/link';
import Image from 'next/image';
import { mustHotlink } from '@/lib/images';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import {
  getArticlesServer,
  getEventsServer,
  getMembersServer,
  getMemberServer,
  getMyArticlesServer,
  getMyMemberProfileServer,
  getReceivedConsultationsServer,
} from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge, Button, Card, Eyebrow } from '@/components/ui';
import { cache, Suspense, type ReactNode } from 'react';
import { MemberSection } from '@/components/dashboard/MemberSection';
import type { Profile } from '@/lib/auth/types';

export const metadata = { title: 'Member dashboard — GrowXQ' };

function Panel({
  title,
  href,
  action = 'View all',
  children,
}: {
  title: string;
  href: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <Card padding="md">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">{title}</h2>
        <Link href={href} className="text-sm font-medium text-accent hover:underline">
          {action} <span aria-hidden="true">↗</span>
        </Link>
      </div>
      {children}
    </Card>
  );
}
function Message({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm text-ink-3">{children}</p>;
}

// Each section is its own async Server Component behind a Suspense boundary, so the greeting renders
// at once and every panel streams in as its own request returns. Each one can fail independently,
// without disguising unavailable data as zero activity: a loader resolves to { ok: false } instead
// of throwing. The loaders are cache()d — the stats row and the panels share one request each.
type Loaded<T> = { ok: true; value: T } | { ok: false };

function settle<T>(promise: Promise<T>): Promise<Loaded<T>> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const })
  );
}

const loadRequests = cache(() => settle(getReceivedConsultationsServer()));
const loadMyArticles = cache(() => settle(getMyArticlesServer()));
const loadProfile = cache(() =>
  settle(getMyMemberProfileServer().then((member) => (member ? getMemberServer(member.slug) : null)))
);
const loadNewestMembers = cache(() => settle(getMembersServer('?sort=newest&pageSize=5')));

function PanelSkeleton({ className = 'h-72' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-card bg-bg-alt ${className}`} />;
}

async function StatsRow() {
  const [consultations, mine] = await Promise.all([loadRequests(), loadMyArticles()]);
  const requests = consultations.ok ? consultations.value : null;
  const ownArticles = mine.ok ? mine.value : null;
  const stats = [
    {
      label: 'Consultations received',
      value: requests?.length,
      detail: 'All requests to your practice',
      href: '/consultations',
    },
    {
      label: 'Awaiting your response',
      value: requests?.filter((r) => r.status === 'pending').length,
      detail: 'Pending consultation requests',
      href: '/consultations',
    },
    {
      label: 'Articles published',
      value: ownArticles?.filter((a) => a.status === 'published').length,
      detail: 'Expertise shared with the community',
      href: '/articles?tab=mine',
    },
    {
      label: 'In editorial review',
      value: ownArticles?.filter((a) => a.status === 'pending_review').length,
      detail: 'Your submitted contributions',
      href: '/articles?tab=mine',
    },
  ];
  return (
    <>
      {stats.map((stat, i) => (
        <Link key={stat.label} href={stat.href} className="group min-w-0">
          <Card padding="md" className="h-full transition-colors group-hover:border-accent">
            <div className="flex items-center justify-between text-ink-3">
              <span className="text-xs">0{i + 1} / Your activity</span>
              <span aria-hidden="true" className="text-accent">
                ↗
              </span>
            </div>
            <p className="mb-2 mt-5 text-4xl font-medium text-ink">{stat.value ?? '—'}</p>
            <h2 className="font-sans text-sm font-semibold">{stat.label}</h2>
            <p className="mt-1 text-xs text-ink-3">
              {stat.value === undefined ? 'Temporarily unavailable' : stat.detail}
            </p>
          </Card>
        </Link>
      ))}
    </>
  );
}

async function RequestsPanel() {
  const consultations = await loadRequests();
  const requests = consultations.ok ? consultations.value : null;
  return (
    <Panel title="Consultation requests" href="/consultations" action="Manage requests">
      {requests === null ? (
        <Message>We couldn’t load your requests. Refresh to try again.</Message>
      ) : !requests.length ? (
        <Message>No requests yet. Your public profile helps potential clients discover your expertise.</Message>
      ) : (
        <div className="divide-y divide-line">
          {[...requests]
            .sort(
              (a, b) =>
                Number(b.status === 'pending') - Number(a.status === 'pending') ||
                Date.parse(b.createdAt) - Date.parse(a.createdAt)
            )
            .slice(0, 5)
            .map((r) => (
              <Link
                key={r.id}
                href="/consultations"
                className="flex flex-wrap items-center gap-3 rounded-lg py-4 transition-colors hover:bg-bg-alt"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neon text-sm font-medium text-ink"
                >
                  {r.requesterName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.requesterName}</p>
                  <p className="truncate text-xs text-ink-3">
                    {r.serviceName || r.customServiceLabel || 'Consultation request'}
                  </p>
                </div>
                <Badge variant={r.status === 'pending' ? 'warning' : r.status === 'completed' ? 'success' : 'neutral'}>
                  {r.status === 'pending' ? 'Pending' : r.status === 'completed' ? 'Completed' : 'Declined'}
                </Badge>
              </Link>
            ))}
        </div>
      )}
    </Panel>
  );
}

async function CommunityArticlesPanel() {
  const articles = await settle(getArticlesServer({ pageSize: 3 }));
  return (
    <Panel title="Ideas from the community" href="/articles" action="Explore articles">
      {!articles.ok ? (
        <Message>Articles are temporarily unavailable. Refresh to try again.</Message>
      ) : !articles.value.items.length ? (
        <Message>The next conversation starts with you. Share your first article with the community.</Message>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {articles.value.items.slice(0, 3).map((a) => (
            <Link
              key={a.id}
              href={`/articles/${a.slug}`}
              className="group flex min-w-0 flex-col rounded-xl bg-bg-alt/60 p-5"
            >
              <span className="text-xs font-medium text-accent">{a.services[0]?.name || 'Expert insight'}</span>
              <h3 className="mb-3 mt-4 text-title text-ink group-hover:text-accent">{a.title}</h3>
              <p className="mb-5 line-clamp-3 text-sm text-ink-3">{a.excerpt}</p>
              <p className="mt-auto border-t border-line pt-4 text-xs text-ink-3">{a.authorName}</p>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

async function NewMembersPanel({ userId }: { userId: string }) {
  const newest = await loadNewestMembers();
  const newMembers = newest.ok ? newest.value.filter((m) => m.id !== userId).slice(0, 4) : [];
  return (
    <MemberSection
      title="New members"
      members={newMembers}
      joinDates={Object.fromEntries(newMembers.filter((m) => m.joinedAt).map((m) => [m.id, m.joinedAt!]))}
      error={!newest.ok ? 'New members are temporarily unavailable. Refresh to try again.' : undefined}
    />
  );
}

async function ConnectMembersPanel({ userId }: { userId: string }) {
  // Skips whoever the "New members" panel already shows.
  const [members, newest] = await Promise.all([settle(getMembersServer('?pageSize=12')), loadNewestMembers()]);
  const newMemberIds = new Set(
    newest.ok
      ? newest.value
          .filter((m) => m.id !== userId)
          .slice(0, 4)
          .map((m) => m.id)
      : []
  );
  return (
    <MemberSection
      title="Members you can connect with"
      members={members.ok ? members.value.filter((m) => m.id !== userId && !newMemberIds.has(m.id)).slice(0, 4) : []}
      error={!members.ok ? 'Members are temporarily unavailable. Refresh to try again.' : undefined}
    />
  );
}

async function ProfileCard({ user }: { user: Profile }) {
  const profile = await loadProfile();
  const member = profile.ok ? profile.value : null;
  return (
    <Card padding="md">
      <Eyebrow>Your profile</Eyebrow>
      <div className="mb-4 mt-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-neon text-lg font-medium text-ink">
        {member?.photoUrl ? (
          <Image
            src={member.photoUrl}
            unoptimized={mustHotlink(member.photoUrl)}
            alt={`${user.first_name} ${user.last_name}`}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {user.first_name.slice(0, 1)}
            {user.last_name.slice(0, 1)}
          </>
        )}
      </div>
      <h2 className="break-words text-title">
        {user.first_name} {user.last_name}
      </h2>
      <p className="mb-5 mt-2 text-sm text-ink-3">
        Keep your expertise and experience up to date so the right opportunities find you.
      </p>
      {member ? (
        <Button href={`/members/${member.slug}`} variant="secondary" fullWidth>
          View & edit profile
        </Button>
      ) : (
        <p className="text-sm text-ink-3">
          {!profile.ok ? 'Your profile is temporarily unavailable.' : 'Your member profile is being prepared.'}
        </p>
      )}
    </Card>
  );
}

async function UpcomingEventsPanel() {
  const events = await settle(getEventsServer({ upcoming: true }));
  return (
    <Panel title="Upcoming events" href="/events" action="Browse">
      {!events.ok ? (
        <Message>Events are temporarily unavailable. Refresh to try again.</Message>
      ) : !events.value.length ? (
        <Message>No upcoming events right now. Check back for the next community gathering.</Message>
      ) : (
        <div className="divide-y divide-line">
          {events.value.slice(0, 3).map((e) => (
            <Link key={e.id} href={`/events#event-${e.id}`} className="flex gap-3 py-4">
              <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-bg-alt text-xs text-ink-3">
                <span>
                  {new Date(e.startDate).toLocaleDateString('en-US', {
                    month: 'short',
                    timeZone: e.timezone || 'UTC',
                  })}
                </span>
                <strong className="text-lg text-ink">
                  {new Date(e.startDate).toLocaleDateString('en-US', {
                    day: 'numeric',
                    timeZone: e.timezone || 'UTC',
                  })}
                </strong>
              </span>
              <div>
                <h3 className="text-sm font-medium hover:text-accent">{e.title}</h3>
                <p className="mt-1 text-xs text-ink-3">
                  {e.eventFormat === 'virtual'
                    ? 'Virtual'
                    : [e.city, e.country].filter(Boolean).join(', ') || 'View event details'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?returnTo=/dashboard');
  if (user.role !== 'member') redirect(user.role === 'admin' ? '/admin' : '/membership');

  return (
    <div className="bg-bg-alt/40">
      <section className="relative overflow-hidden bg-ink py-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute hidden sm:block -right-24 -top-32 h-96 w-96 rounded-full border border-accent/20"
        >
          <div className="absolute inset-12 rounded-full border border-accent/20" />
          <div className="absolute inset-24 rounded-full border border-accent/20" />
        </div>
        <PageContainer className="relative">
          <div className="flex flex-wrap items-end justify-between gap-7">
            <div className="max-w-2xl">
              <Eyebrow dark>Member portal</Eyebrow>
              <h1 className="mt-4 break-words text-headline text-white">
                Hello, <span className="text-accent">{user.first_name || 'there'}.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lede text-white/65">
                Your practice at a glance. Make meaningful connections, share your expertise, and keep moving forward.
              </p>
            </div>
            <Button href="/articles/write" variant="secondary-dark">
              Write an article <span aria-hidden="true">↗</span>
            </Button>
          </div>
        </PageContainer>
      </section>
      <PageContainer className="py-8 sm:py-10">
        <div className="mb-8 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <Suspense
            fallback={[0, 1, 2, 3].map((i) => (
              <PanelSkeleton key={i} className="h-44" />
            ))}
          >
            <StatsRow />
          </Suspense>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Suspense fallback={<PanelSkeleton />}>
              <RequestsPanel />
            </Suspense>
            <Suspense fallback={<PanelSkeleton />}>
              <CommunityArticlesPanel />
            </Suspense>
            <Suspense fallback={<PanelSkeleton className="h-56" />}>
              <NewMembersPanel userId={user.id} />
            </Suspense>
            <Suspense fallback={<PanelSkeleton className="h-56" />}>
              <ConnectMembersPanel userId={user.id} />
            </Suspense>
          </div>
          <aside className="min-w-0 space-y-6" aria-label="Your profile and upcoming events">
            <Suspense fallback={<PanelSkeleton className="h-80" />}>
              <ProfileCard user={user} />
            </Suspense>
            <Suspense fallback={<PanelSkeleton />}>
              <UpcomingEventsPanel />
            </Suspense>
            <div className="rounded-card bg-ink p-6 text-white">
              <Eyebrow dark>Make your next move</Eyebrow>
              <h2 className="mt-4 text-title">Your knowledge can open doors.</h2>
              <p className="mb-5 mt-3 text-sm text-white/65">
                Turn an experience, a fresh perspective, or a lesson learned into your next contribution.
              </p>
              <Button href="/articles/write" variant="secondary-dark" fullWidth>
                Share your expertise ↗
              </Button>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
