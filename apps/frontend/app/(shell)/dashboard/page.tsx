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
  getMyApplicationServer,
  getMyArticlesServer,
  getMyConsultationsServer,
  getMyMemberProfileServer,
  getReceivedConsultationsServer,
} from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { Badge, Button, Card, Eyebrow } from '@/components/ui';
import { cache, Suspense, type ReactNode } from 'react';
import { MemberSection } from '@/components/dashboard/MemberSection';
import { DashboardArticles } from '@/components/dashboard/DashboardArticles';
import { DashboardHeroSearch } from '@/components/dashboard/DashboardHeroSearch';
import { HeroConstellation } from '@/components/layout/HeroConstellation';
import { computeCompletionPct } from '@/lib/members/completion';
import type { Profile } from '@/lib/auth/types';
import { formatDate, formatDayOfMonth, formatMonth } from '@/lib/dates';
import { isOnlineEvent, normalizeEventTitle } from '@/lib/events/format';

export const metadata = { title: 'Dashboard — GrowXQ' };

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

const loadSentRequests = cache(() => settle(getMyConsultationsServer()));

const STATUS_BADGE = {
  pending: { variant: 'warning', label: 'Awaiting reply' },
  completed: { variant: 'success', label: 'Completed' },
  declined: { variant: 'neutral', label: 'Declined' },
} as const;

function PanelSkeleton({ className = 'h-72' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-card bg-bg-alt ${className}`} />;
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

async function UpcomingEventsPanel() {
  const events = await settle(getEventsServer());
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
              <span className="flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-bg-alt px-2 text-xs text-ink-3">
                <span>{formatMonth(e.startDate, { timeZone: e.timezone, utc: true })}</span>
                <strong className="text-lg text-ink">
                  {formatDayOfMonth(e.startDate, { timeZone: e.timezone, utc: true })}
                </strong>
              </span>
              <div>
                <h3 className="text-sm font-medium hover:text-accent">{normalizeEventTitle(e.title)}</h3>
                <p className="mt-1 text-xs text-ink-3">
                  {isOnlineEvent(e) ? 'Online' : [e.city, e.country].filter(Boolean).join(', ') || 'View event details'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Member dashboard (design/static_html/dashboard.html) ─────────────────────────────────────
// The prototype's layout with real data only. Its view-count "Reach", "Network expanded",
// monthly goals, Top contributors and Schedule need data the backend doesn't record (view
// tracking, Peer Connect, a leaderboard, booked consultation slots), so they're left out.

function TileIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/25 bg-bg-card text-accent-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </span>
  );
}

async function RoiPanel() {
  const [consultations, mine] = await Promise.all([loadRequests(), loadMyArticles()]);
  const requests = consultations.ok ? consultations.value : null;
  const own = mine.ok ? mine.value : null;
  const pending = requests?.filter((r) => r.status === 'pending').length;
  const completed = requests?.filter((r) => r.status === 'completed').length;
  const published = own?.filter((a) => a.status === 'published').length;
  const inReview = own?.filter((a) => a.status === 'pending_review').length;
  const drafts = own?.filter((a) => a.status === 'draft').length;
  const tiles: { value?: number; label: string; detail: string; href: string; icon: ReactNode }[] = [
    {
      value: requests?.length,
      label: 'Consultations received',
      detail: `${pending ?? 0} pending · ${completed ?? 0} completed`,
      href: '/consultations',
      icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
    },
    {
      value: pending,
      label: 'Awaiting your reply',
      detail: pending ? 'Clients are waiting to hear back' : 'You’re all caught up',
      href: '/consultations',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ),
    },
    {
      value: published,
      label: 'Publications made',
      detail: inReview ? `${inReview} in review` : 'Under your name, searchable',
      href: '/articles?tab=mine',
      icon: (
        <>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </>
      ),
    },
    {
      value: drafts,
      label: 'Drafts in progress',
      detail: drafts ? 'Finish one to publish it' : 'Start your next article',
      href: '/articles?tab=mine',
      icon: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />,
    },
  ];
  return (
    <Card padding="md">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">Your ROI on GrowXQ</h2>
        <span className="text-caption text-ink-3">This membership cycle</span>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="min-w-0 rounded-panel border border-accent/20 bg-neon/50 p-4 transition-colors hover:border-accent sm:p-5"
          >
            <TileIcon>{t.icon}</TileIcon>
            <p className="mt-4 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">{t.value ?? '—'}</p>
            <p className="mt-2 text-sm font-medium text-ink-2">{t.label}</p>
            <p className="mt-2 text-xs font-semibold text-accent-2">
              {t.value === undefined ? 'Temporarily unavailable' : t.detail}
            </p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

async function ArticlesSection() {
  const [latest, mine] = await Promise.all([settle(getArticlesServer({ pageSize: 3 })), loadMyArticles()]);
  return (
    <DashboardArticles
      latest={latest.ok ? latest.value.items : []}
      latestError={!latest.ok}
      mine={mine.ok ? [...mine.value].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) : null}
    />
  );
}

async function RequestsPanel() {
  const consultations = await loadRequests();
  const requests = consultations.ok ? consultations.value : null;
  return (
    <section aria-label="Consultation requests">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">Consultation requests</h2>
        <div className="flex items-center gap-4 text-sm">
          {requests && <span className="text-ink-3">{requests.length} total</span>}
          <Link href="/consultations" className="font-medium text-accent hover:underline">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-bg-card">
        {requests === null ? (
          <p className="px-6 py-8 text-sm text-ink-3">We couldn’t load your requests. Refresh to try again.</p>
        ) : !requests.length ? (
          <p className="px-6 py-8 text-sm text-ink-3">
            No requests yet. Your public profile helps potential clients discover your expertise.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {[...requests]
              .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
              .slice(0, 5)
              .map((r) => (
                <Link
                  key={r.id}
                  href="/consultations"
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg-alt/60 sm:px-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neon text-xs font-medium text-ink">
                    {r.requesterAvatarUrl ? (
                      <Image
                        src={r.requesterAvatarUrl}
                        unoptimized={mustHotlink(r.requesterAvatarUrl)}
                        alt=""
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      r.requesterName.slice(0, 1)
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-3">
                    <span className="flex-none text-sm font-semibold text-ink">{r.requesterName}</span>
                    <span className="truncate text-sm text-ink-3">{r.message}</span>
                  </div>
                  <span className="hidden flex-none text-xs text-ink-4 sm:inline">{formatDate(r.createdAt)}</span>
                  <Badge
                    variant={r.status === 'pending' ? 'warning' : r.status === 'completed' ? 'success' : 'neutral'}
                  >
                    {r.status === 'pending' ? 'Pending' : r.status === 'completed' ? 'Completed' : 'Declined'}
                  </Badge>
                </Link>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

const TIER_LABEL = { seasoned_professional: 'Seasoned', budding_entrepreneur: 'Budding' } as const;

async function ProfileCard({ user }: { user: Profile }) {
  const profile = await loadProfile();
  const member = profile.ok ? profile.value : null;
  const pct = member ? computeCompletionPct(member) : null;
  const ring = pct ?? 0;
  return (
    <Card padding="md" className="text-center">
      <p className="text-left text-mono-label text-ink-3">Profile</p>
      <Link href={member ? `/members/${member.slug}` : '#'} className="mx-auto mt-4 block w-fit">
        <span
          className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full"
          style={{ background: `conic-gradient(var(--accent) ${ring * 3.6}deg, var(--line) 0deg)` }}
        >
          <span className="flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded-full border-4 border-bg-card bg-neon text-lg font-medium text-ink">
            {member?.photoUrl ? (
              <Image
                src={member.photoUrl}
                unoptimized={mustHotlink(member.photoUrl)}
                alt={`${user.first_name} ${user.last_name}`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                {user.first_name.slice(0, 1)}
                {user.last_name.slice(0, 1)}
              </>
            )}
          </span>
          {pct !== null && (
            <span className="absolute -bottom-1 right-0 rounded-full border border-line bg-bg-card px-1.5 py-0.5 text-[10px] font-semibold text-accent-2">
              {pct}%
            </span>
          )}
        </span>
      </Link>
      <h2 className="mt-4 flex items-center justify-center gap-1.5 break-words text-title">
        {user.first_name} {user.last_name}
        {member?.isVerified && (
          <span
            aria-label="Verified"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-bg"
          >
            ✓
          </span>
        )}
      </h2>
      {member ? (
        <>
          {(member.headline || member.firmName) && (
            <p className="mt-1.5 text-sm text-ink-3">
              {[member.headline, member.firmName].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="mt-2 text-sm text-ink-3">{[member.city, member.country].filter(Boolean).join(', ')}</p>
          <span className="mt-4 inline-flex rounded-full border border-accent/30 bg-neon px-3 py-1 text-[11px] font-semibold text-accent-2">
            {TIER_LABEL[member.memberTier]} · {member.yearsOfExperience} yrs
          </span>
          {pct !== null && pct < 100 && (
            <Link
              href={`/members/${member.slug}`}
              className="mt-4 block text-sm font-medium text-accent hover:underline"
            >
              Complete your profile <span aria-hidden="true">→</span>
            </Link>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-3">
          {!profile.ok ? 'Your profile is temporarily unavailable.' : 'Your member profile is being prepared.'}
        </p>
      )}
    </Card>
  );
}

// The current membership year: the last anniversary of the start date up to the next one.
function membershipCycle(startIso: string, now = new Date()) {
  const start = new Date(startIso);
  let cycleStart = new Date(start);
  let years = 0;
  while (true) {
    const next = new Date(start);
    next.setFullYear(start.getFullYear() + years + 1);
    if (next > now) {
      const total = next.getTime() - cycleStart.getTime();
      const elapsed = Math.max(0, now.getTime() - cycleStart.getTime());
      return {
        renewal: next,
        progress: Math.min(1, elapsed / total),
        daysLeft: Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86_400_000)),
      };
    }
    years += 1;
    cycleStart = next;
  }
}

async function MembershipCard() {
  const profile = await loadProfile();
  const member = profile.ok ? profile.value : null;
  const startIso = member?.joinedAt;
  const cycle = startIso ? membershipCycle(startIso) : null;
  return (
    <section className="rounded-card border border-accent/25 bg-neon/60 p-5 sm:p-6" aria-label="Membership">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-title text-ink">Membership</h2>
        {member && (
          <span className="rounded-full border border-accent/30 bg-bg-card px-2.5 py-1 text-[11px] font-semibold text-accent-2">
            {member.memberTier === 'seasoned_professional' ? 'Seasoned Professional' : 'Budding Entrepreneur'}
          </span>
        )}
      </div>
      {startIso && cycle ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <div className="text-caption text-ink-3">Start date</div>
              <div className="mt-1 text-[17px] font-semibold text-ink">{formatDate(startIso)}</div>
            </div>
            <div>
              <div className="text-caption text-ink-3">Renewal date</div>
              <div className="mt-1 text-[17px] font-semibold text-ink">{formatDate(cycle.renewal)}</div>
            </div>
          </div>
          <div
            className="mt-5 h-1.5 overflow-hidden rounded-full bg-bg-card"
            role="progressbar"
            aria-label="Current membership cycle"
            aria-valuenow={Math.round(cycle.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${cycle.progress * 100}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-ink-3">Current cycle</span>
            <span className="font-semibold text-accent-2">{cycle.daysLeft} days left</span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-3">
          {!profile.ok ? 'Membership details are temporarily unavailable.' : 'Your membership dates will appear here.'}
        </p>
      )}
    </section>
  );
}

async function MemberEventsPanel() {
  const events = await settle(getEventsServer());
  return (
    <Card padding="md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-title text-ink">Upcoming events</h2>
        <Link href="/events" className="text-sm font-medium text-accent hover:underline">
          Browse all <span aria-hidden="true">→</span>
        </Link>
      </div>
      {!events.ok ? (
        <Message>Events are temporarily unavailable. Refresh to try again.</Message>
      ) : !events.value.length ? (
        <Message>No upcoming events right now.</Message>
      ) : (
        <ul className="divide-y divide-line">
          {events.value.slice(0, 3).map((e) => (
            <li key={e.id}>
              <Link href={`/events#event-${e.id}`} className="group flex items-center gap-3 py-3">
                <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:text-accent">
                  {normalizeEventTitle(e.title)}
                </span>
                <span className="flex-none text-[11px] uppercase text-ink-4">
                  {formatMonth(e.startDate, { timeZone: e.timezone, utc: true }).slice(0, 3)}{' '}
                  {formatDayOfMonth(e.startDate, { timeZone: e.timezone, utc: true }).padStart(2, '0')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function RemindersCard() {
  const [profile, consultations, mine] = await Promise.all([loadProfile(), loadRequests(), loadMyArticles()]);
  const member = profile.ok ? profile.value : null;
  const cycle = member?.joinedAt ? membershipCycle(member.joinedAt) : null;
  const pending = consultations.ok ? consultations.value.filter((r) => r.status === 'pending').length : 0;
  const drafts = mine.ok ? mine.value.filter((a) => a.status === 'draft') : [];
  const reminders: { title: string; detail: string; href: string; icon: ReactNode }[] = [];
  if (cycle && cycle.daysLeft <= 60) {
    reminders.push({
      title: `Membership renews in ${cycle.daysLeft} days`,
      detail: formatDate(cycle.renewal),
      href: '/membership',
      icon: (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </>
      ),
    });
  }
  if (pending) {
    reminders.push({
      title: `${pending} consultation ${pending === 1 ? 'request' : 'requests'} awaiting reply`,
      detail: 'Respond from your consultations page',
      href: '/consultations',
      icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
    });
  }
  if (drafts.length) {
    reminders.push({
      title: `${drafts.length} ${drafts.length === 1 ? 'article' : 'articles'} still in draft`,
      detail: `Finish “${drafts[0].title}”`,
      href: `/articles/write?edit=${drafts[0].id}`,
      icon: (
        <>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </>
      ),
    });
  }
  return (
    <section className="relative overflow-hidden rounded-card bg-ink p-6 text-white" aria-label="Reminders">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full"
        style={{ background: 'color-mix(in oklab, var(--accent) 18%, transparent)' }}
      />
      <h2 className="relative text-title text-white">Reminders</h2>
      {reminders.length === 0 ? (
        <p className="relative mt-4 text-sm text-white/60">You’re all caught up.</p>
      ) : (
        <ul className="relative mt-5 space-y-4">
          {reminders.map((r) => (
            <li key={r.title}>
              <Link href={r.href} className="group flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-bg">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {r.icon}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white group-hover:underline">{r.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-white/55">{r.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Client dashboard ────────────────────────────────────────────────────────────────────────
// A client's view: the consultations they've requested, where their membership application
// stands, experts to reach out to, and what's happening in the community.

async function ClientStatsRow() {
  const [sent, application] = await Promise.all([loadSentRequests(), settle(getMyApplicationServer())]);
  const requests = sent.ok ? sent.value : null;
  const app = application.ok ? application.value : undefined;
  const appLabel =
    app === undefined
      ? '—'
      : app === null
        ? 'Not yet'
        : {
            draft: 'Draft',
            submitted: 'Submitted',
            under_review: 'In review',
            approved: 'Approved',
            rejected: 'Not approved',
          }[app.status];
  const stats = [
    {
      label: 'Consultations requested',
      value: requests?.length,
      detail: 'Experts you have contacted',
      href: '/consultations',
    },
    {
      label: 'Awaiting a reply',
      value: requests?.filter((r) => r.status === 'pending').length,
      detail: 'Experts usually reply within a few days',
      href: '/consultations',
    },
    {
      label: 'Completed',
      value: requests?.filter((r) => r.status === 'completed').length,
      detail: 'Consultations wrapped up',
      href: '/consultations',
    },
    {
      label: 'Membership application',
      value: appLabel,
      detail: app === null ? 'Practise finance or law? Apply to join' : 'Your application status',
      href: app === null || app?.status === 'draft' ? '/apply' : '/membership',
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

async function SentRequestsPanel() {
  const sent = await loadSentRequests();
  const requests = sent.ok ? sent.value : null;
  return (
    <Panel title="Your consultation requests" href="/consultations" action="View all">
      {requests === null ? (
        <Message>We couldn’t load your requests. Refresh to try again.</Message>
      ) : !requests.length ? (
        <div className="flex flex-col items-start gap-4 py-2">
          <Message>
            You haven’t requested a consultation yet. Find a verified expert and send them your question.
          </Message>
          <Button href="/members" size="sm">
            Find an expert →
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {requests.slice(0, 5).map((r) => (
            <Link
              key={r.id}
              href="/consultations"
              className="flex flex-wrap items-center gap-3 rounded-lg py-4 transition-colors hover:bg-bg-alt"
            >
              {r.memberAvatarUrl ? (
                <Image
                  src={r.memberAvatarUrl}
                  unoptimized={mustHotlink(r.memberAvatarUrl)}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neon text-sm font-medium text-ink"
                >
                  {(r.memberName ?? '?').slice(0, 1)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.memberName ?? 'GrowXQ member'}</p>
                <p className="truncate text-xs text-ink-3">
                  {[r.serviceName || r.customServiceLabel || 'Consultation', r.memberFirmName]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Badge variant={STATUS_BADGE[r.status].variant}>{STATUS_BADGE[r.status].label}</Badge>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

async function ClientExpertsPanel() {
  const members = await settle(getMembersServer('?pageSize=4'));
  return (
    <MemberSection
      title="Experts you can consult"
      members={members.ok ? members.value.slice(0, 4) : []}
      error={!members.ok ? 'Members are temporarily unavailable. Refresh to try again.' : undefined}
    />
  );
}

async function ClientDashboard({ user }: { user: Profile }) {
  return (
    <div className="bg-bg-alt/40">
      <PageHero
        eyebrow="Your dashboard"
        title={
          <>
            Hello, <span className="text-accent">{user.first_name || 'there'}.</span>
          </>
        }
        lede="Track your consultations, find the right expert, and keep up with what the network is sharing."
        action={
          <Button href="/members" variant="secondary-dark">
            Find an expert <span aria-hidden="true">↗</span>
          </Button>
        }
        decoration={
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 hidden h-96 w-96 rounded-full border border-accent/20 sm:block"
          >
            <div className="absolute inset-12 rounded-full border border-accent/20" />
            <div className="absolute inset-24 rounded-full border border-accent/20" />
          </div>
        }
      />
      <PageContainer className="py-8 sm:py-10">
        <div className="mb-8 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <Suspense
            fallback={[0, 1, 2, 3].map((i) => (
              <PanelSkeleton key={i} className="h-44" />
            ))}
          >
            <ClientStatsRow />
          </Suspense>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Suspense fallback={<PanelSkeleton />}>
              <SentRequestsPanel />
            </Suspense>
            <Suspense fallback={<PanelSkeleton className="h-56" />}>
              <ClientExpertsPanel />
            </Suspense>
            <Suspense fallback={<PanelSkeleton />}>
              <CommunityArticlesPanel />
            </Suspense>
          </div>
          <aside className="min-w-0 space-y-6" aria-label="Upcoming events and membership">
            <Suspense fallback={<PanelSkeleton />}>
              <UpcomingEventsPanel />
            </Suspense>
            <div className="rounded-card bg-ink p-6 text-white">
              <Eyebrow dark>For practitioners</Eyebrow>
              <h2 className="mt-4 text-title">Work in finance or law?</h2>
              <p className="mb-5 mt-3 text-sm text-white/65">
                Apply for membership to be discovered by clients, publish articles and join member events.
              </p>
              <Button href="/membership" variant="secondary-dark" fullWidth>
                See membership ↗
              </Button>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?returnTo=/dashboard');
  if (user.role === 'admin') redirect('/admin');
  if (user.role === 'client') return <ClientDashboard user={user} />;

  return (
    <div className="bg-bg-alt/40">
      <PageHero
        eyebrow="Member Portal"
        title={
          <>
            Hello, <span className="text-accent">{user.first_name || 'there'}.</span>
          </>
        }
        lede="Here's your practice at a glance - membership, contributions, and what needs your attention."
        search={<DashboardHeroSearch />}
        decoration={<HeroConstellation />}
      />
      <PageContainer className="py-8 sm:py-10">
        {/* Desktop: two columns, as dashboard.html. Below xl the columns dissolve (display: contents)
            into one list, ordered by what a member needs first: who they are, their numbers, what
            to act on, then everything else. */}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="contents xl:block xl:min-w-0 xl:space-y-8">
            <div className="min-w-0 max-xl:order-2">
              <Suspense fallback={<PanelSkeleton className="h-60" />}>
                <RoiPanel />
              </Suspense>
            </div>
            <div className="min-w-0 max-xl:order-5">
              <Suspense fallback={<PanelSkeleton />}>
                <ArticlesSection />
              </Suspense>
            </div>
            <div className="min-w-0 max-xl:order-4">
              <Suspense fallback={<PanelSkeleton className="h-56" />}>
                <RequestsPanel />
              </Suspense>
            </div>
            <div className="min-w-0 max-xl:order-8">
              <Suspense fallback={<PanelSkeleton className="h-56" />}>
                <NewMembersPanel userId={user.id} />
              </Suspense>
            </div>
          </div>
          <aside
            className="contents xl:block xl:min-w-0 xl:space-y-5"
            aria-label="Your profile, membership and reminders"
          >
            <div className="min-w-0 max-xl:order-1">
              <Suspense fallback={<PanelSkeleton className="h-72" />}>
                <ProfileCard user={user} />
              </Suspense>
            </div>
            <div className="min-w-0 max-xl:order-6">
              <Suspense fallback={<PanelSkeleton className="h-48" />}>
                <MembershipCard />
              </Suspense>
            </div>
            <div className="min-w-0 max-xl:order-7">
              <Suspense fallback={<PanelSkeleton className="h-48" />}>
                <MemberEventsPanel />
              </Suspense>
            </div>
            <div className="min-w-0 max-xl:order-3">
              <Suspense fallback={<PanelSkeleton className="h-48" />}>
                <RemindersCard />
              </Suspense>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
