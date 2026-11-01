import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth/session-claims';
import { canApplyForMembership } from '@/lib/auth/roles';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Eyebrow } from '@/components/ui';
import {
  ArticleMock,
  DealsMock,
  DiscussionsMock,
  EventsMock,
  PeersMock,
  SearchMock,
} from '@/components/membership/BenefitMocks';

export const metadata = {
  title: 'Membership benefits — GrowXQ',
  description:
    'One flat annual fee: client discovery, unlimited publishing, a vetted peer network and member events — with zero commission on any work you win.',
};

// Section for section and in the same order, design/static_html/membership.html, with its copy
// (Expertly → GrowXQ). The only departures are the prototype's invented figures: the $699 anchor
// and "Save 29%", the $49/month plan, "Cancel anytime", live "online now"/view counts, "50+"
// partner deals and the attributed testimonial — so nothing here states a number that isn't true.

const INCLUDED = [
  'Verified profile & discovery listing',
  'Client enquiries direct to you',
  'Unlimited article publishing',
  'Peer 1:1 network & referrals',
  'Member-only events access',
  'Partner deals & discounts',
];

type Benefit = {
  n: string;
  title: ReactNode;
  body: string;
  stats: [string, string][];
  mock: ReactNode;
  soon?: boolean;
};

const BENEFITS: Benefit[] = [
  {
    n: '01 · Client Discovery',
    title: (
      <>
        Stop chasing leads.
        <br />
        Start choosing them.
      </>
    ),
    body: 'Right now, a CFO is searching for a transfer pricing specialist in Singapore. An entrepreneur needs M&A counsel in London. Your verified profile surfaces the instant they search. No bidding wars, no agency cut, no cold outreach. Just qualified enquiries landing straight with you.',
    stats: [
      ['$0', 'Commission charged'],
      ['100%', 'Fees kept by you'],
      ['Direct', 'Client-to-you contact'],
    ],
    mock: <SearchMock />,
  },
  {
    n: '02 · Thought Leadership',
    title: (
      <>
        Publish once.
        <br />
        Get discovered forever.
      </>
    ),
    body: 'A sharp take on regulatory change is the reason a client calls you instead of the firm next door. Every article you publish on GrowXQ becomes a permanent, searchable asset, surfaced to clients typing the exact question you just answered, compounding your credibility with every read.',
    stats: [
      ['∞', 'Articles published'],
      ['Indexed', 'For client search'],
      ['Yours', 'Always under your name'],
    ],
    mock: <ArticleMock />,
  },
  {
    n: '03 · Peer Network',
    title: '1:1 calls with peers who get it.',
    body: 'This isn’t LinkedIn. Every member is manually vetted, credentials are checked and references are confirmed, so a 1:1 call here is always worth your time. Trade referrals on work outside your scope, get a second opinion on a complex cross-border matter, or talk shop with someone who’s actually been in your seat.',
    stats: [
      ['Verified', 'Every single member'],
      ['1:1', 'Direct calls, no platform between'],
    ],
    mock: <PeersMock />,
  },
  {
    n: '04 · Perks & Product Discounts',
    title: (
      <>
        Deals on the tools
        <br />
        your practice runs on.
      </>
    ),
    body: 'You’re already paying full price for the research, AI, accounting and productivity tools your practice runs on. The moment you join GrowXQ, they get cheaper. No forms, no haggling, the discount is just there, waiting for you. And the deals keep piling up every quarter.',
    stats: [
      ['Partner', 'Deals & discounts'],
      ['Growing', 'New deals each quarter'],
    ],
    mock: <DealsMock />,
    soon: true,
  },
  {
    n: '05 · Community Discussions',
    title: (
      <>
        Ask. Answer. Learn.
        <br />
        With people who know.
      </>
    ),
    body: 'Members get access to topic-based discussion groups: International Tax, M&A, GST, Corporate Law, Capital Markets, and more. Ask a nuanced question and get a real answer from a verified peer or a recognised expert in that field. Not a forum. Not a Reddit thread. A professional community with credentials behind every reply.',
    stats: [
      ['Verified', 'Every respondent'],
      ['Topic', 'Groups by practice area'],
      ['Always', 'On, across time zones'],
    ],
    mock: <DiscussionsMock />,
    soon: true,
  },
  {
    n: '06 · Exclusive Events',
    title: (
      <>
        In the room with
        <br />
        the right people.
      </>
    ),
    body: 'Roundtables, webinars, and in-person events at global financial centres, reserved exclusively for verified members. Curated by practice area and jurisdiction so every session is directly relevant to your work, not a generic industry conference.',
    stats: [
      ['Members', 'Only, not public'],
      ['Global', 'Financial centres'],
    ],
    mock: <EventsMock />,
    soon: true,
  },
];

const STEPS: [string, string, string][] = [
  ['Apply', 'Submit your credentials, practice details, and two peer references. Takes about 10 minutes.', '10 min'],
  ['Verify', 'Our team manually cross-checks every credential and contacts your references.', '5 business days'],
  [
    'Onboard',
    'Build your profile, set rates and availability, and publish your first article, with team support throughout.',
    'Live in ~2 weeks',
  ],
  [
    'Grow',
    'Clients discover you via AI search, direct browsing, or your articles. Every enquiry comes straight to you.',
    'From day one',
  ],
];

const CHECKS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Fact check',
    body: 'Every key fact you submit is verified. Whether it is about you, key engagements & clients, testimonials or awards & recognitions, it shall be verified by our GrowXQ team.',
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    title: 'Professional history',
    body: 'LinkedIn history and submitted work experience are cross-checked for consistency before a profile is approved.',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 15h4" />
      </>
    ),
  },
  {
    title: 'Peer references',
    body: 'Two professional references are contacted directly as part of every application - no exceptions, regardless of seniority.',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
  },
  {
    title: 'Periodical fact check',
    body: 'Verification isn’t one time exercise - facts & conduct are reviewed on an ongoing basis to keep the badge meaningful.',
    icon: (
      <>
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </>
    ),
  },
];

function Arrow() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function CheckDot({ dark = false }: { dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold ${dark ? 'bg-accent/20 text-accent' : 'border border-accent/40 bg-neon text-accent-2'}`}
    >
      ✓
    </span>
  );
}

function SoonBadge() {
  return (
    <span className="mb-4 inline-flex rounded-full border border-accent/30 bg-neon px-2.5 py-1 text-[11px] font-semibold text-accent-2">
      Coming soon
    </span>
  );
}

export default async function MembershipPage() {
  const user = await getSessionUser();
  const showApply = canApplyForMembership(user);

  return (
    <div>
      {/* 1 · Hero */}
      <section className="relative overflow-hidden border-b border-line py-20 max-[640px]:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--neon) 0%, transparent 70%)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_0%,black,transparent_60%)]"
        />
        <PageContainer className="relative grid items-center gap-12 lg:grid-cols-[1fr_440px]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-neon px-3 py-1.5 text-xs font-semibold text-accent-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
              GrowXQ Membership
            </span>
            <h1 className="font-brand mt-5 text-balance text-headline text-ink">
              Everything you need to grow your practice,{' '}
              <span className="text-accent">without ever giving up a cut</span> of what you earn.
            </h1>
            <p className="mt-5 max-w-[560px] text-lede text-ink-3">
              A single flat annual fee unlocks client discovery, unlimited publishing, member events, and partner deals
              with zero commission taken on any work you win.
            </p>
            {showApply && (
              <Button href="/apply" className="mt-8">
                Apply for membership
                <Arrow />
              </Button>
            )}
          </div>

          <div className="w-full overflow-hidden rounded-card border border-line bg-bg-card shadow-[0_24px_60px_-30px_rgba(11,11,12,0.25)] ring-8 ring-neon/60">
            <div className="border-b border-line px-6 py-5">
              <div className="text-mono-label text-ink-2">Included in every plan</div>
              <div className="mt-1 text-caption text-ink-3">Full access from day one</div>
            </div>
            <ul className="divide-y divide-line">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-3 px-6 py-3.5 text-sm text-ink-2">
                  <CheckDot />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4 bg-ink px-6 py-5">
              <div>
                <div className="text-title font-semibold text-bg">From $499/year</div>
                <div className="mt-0.5 text-caption text-white/50">No commission ever</div>
              </div>
              {showApply && (
                <Button href="/apply" variant="ghost-dark" size="sm" className="!border-0 !px-2 text-bg-card">
                  Apply
                  <Arrow />
                </Button>
              )}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 2 · Pull quote */}
      <section className="border-b border-line bg-neon/50 py-16 max-[640px]:py-12">
        <PageContainer className="flex flex-col items-center text-center">
          <span aria-hidden="true" className="h-0.5 w-12 rounded-full bg-accent" />
          <p className="font-brand mt-7 max-w-[760px] text-balance text-section-title italic text-ink">
            “One new client from GrowXQ can pay for years of membership.”
          </p>
        </PageContainer>
      </section>

      {/* 3 · Benefits — text left / panel right, alternating */}
      {BENEFITS.map((b, i) => {
        const reversed = i % 2 === 1;
        return (
          <section key={b.n} className={`border-b border-line py-20 max-[640px]:py-14 ${reversed ? 'bg-neon/40' : ''}`}>
            <PageContainer className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-[72px]">
              <div className={`min-w-0 ${reversed ? 'lg:order-2' : ''}`}>
                {b.soon && <SoonBadge />}
                <div>
                  <Eyebrow>{b.n}</Eyebrow>
                </div>
                <h2 className="font-brand mt-4 text-section-title text-ink">{b.title}</h2>
                <p className="mt-4 max-w-[480px] text-lede text-ink-3">{b.body}</p>
                <dl className="mt-8 flex flex-wrap gap-x-9 gap-y-5 border-t border-line pt-7">
                  {b.stats.map(([value, label]) => (
                    <div key={label} className="flex flex-col-reverse gap-1">
                      <dt className="text-caption text-ink-3">{label}</dt>
                      <dd className="text-stat font-semibold leading-none text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div
                className={`min-w-0 rounded-[28px] border border-line p-8 max-[640px]:p-4 ${reversed ? 'bg-bg-card lg:order-1' : 'bg-neon/50'}`}
              >
                {b.mock}
              </div>
            </PageContainer>
          </section>
        );
      })}

      {/* 4 · Return on investment */}
      <section className="relative overflow-hidden bg-ink py-20 max-[640px]:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 65%)',
          }}
        />
        <PageContainer className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow dark>Return on Investment</Eyebrow>
            <h2 className="font-brand mt-5 text-section-title text-bg-card">
              Pays for itself in <span className="text-accent">a single consultation.</span>
            </h2>
            <p className="mt-5 max-w-[500px] text-lede text-white/55">
              The annual fee is a fraction of what you bill in one hour. One new client, introduced through the
              platform, who&apos;d never have found you otherwise, and the membership has already paid for itself. No
              commission. No hidden fees. Just a flat annual cost.
            </p>
          </div>

          <div className="relative rounded-card border border-accent/40 bg-white/[0.04] p-8 shadow-[0_0_60px_-20px_var(--accent)] max-[640px]:p-6">
            <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-bg">
              <span className="h-1.5 w-1.5 rounded-full bg-bg" />
              Best value · one client pays it off
            </span>
            <div className="text-mono-label text-white/50">GrowXQ Membership · All Professionals</div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-bg-card">$499</span>
              <span className="text-sm text-white/50">/year</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-y border-white/10 py-5 text-sm text-white/75">
              {['Zero commission, ever', 'Full access from day one'].map((perk) => (
                <span key={perk} className="flex items-center gap-2">
                  <CheckDot dark />
                  {perk}
                </span>
              ))}
            </div>
            {showApply && (
              <div className="mt-6 flex justify-end max-[640px]:justify-stretch">
                <Button href="/apply" variant="secondary-dark" className="max-[640px]:w-full">
                  Apply for membership
                  <Arrow />
                </Button>
              </div>
            )}
          </div>
        </PageContainer>
      </section>

      {/* 5 · How to join */}
      <section className="py-20 max-[640px]:py-14">
        <PageContainer>
          <Eyebrow>How to join</Eyebrow>
          <h2 className="font-brand mt-4 text-section-title text-ink">
            Joining is simple. <span className="text-accent">Here&apos;s exactly how it works.</span>
          </h2>
          <ol className="relative mt-12 grid gap-8 rounded-card border border-line bg-bg-card p-10 max-[640px]:p-6 lg:grid-cols-4 lg:gap-6">
            <span
              aria-hidden="true"
              className="absolute left-[12.5%] right-[12.5%] top-[62px] hidden h-px bg-gradient-to-r from-line-2 via-accent/50 to-accent lg:block"
            />
            {STEPS.map(([title, body, time], i) => {
              const last = i === STEPS.length - 1;
              return (
                <li key={title} className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center">
                  <span
                    className={`flex h-11 w-11 flex-none items-center justify-center rounded-full border bg-bg-card text-sm font-semibold ${last ? 'border-accent text-accent ring-4 ring-neon' : 'border-line-2 text-ink'}`}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="lg:mt-4">
                    <h3 className="text-title text-ink">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{body}</p>
                    <span className="mt-3 inline-flex rounded-full border border-accent/30 bg-neon px-2.5 py-1 text-[11px] font-semibold text-accent-2">
                      {time}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </PageContainer>
      </section>

      {/* 6 · Verification standard */}
      <section className="border-y border-line bg-neon/40 py-20 max-[640px]:py-14">
        <PageContainer>
          <Eyebrow>Why members trust the badge</Eyebrow>
          <h2 className="font-brand mt-4 text-section-title text-ink">
            One verification standard. <span className="text-accent">No exceptions.</span>
          </h2>
          <p className="mt-4 max-w-[640px] text-lede text-ink-2">
            Every profile on GrowXQ carries the same &quot;Verified&quot; badge, backed by the same four checks - so
            clients know exactly what it means before they ever send a consultation request.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHECKS.map((c) => (
              <div key={c.title} className="rounded-card border border-line bg-bg-card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon text-accent-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {c.icon}
                  </svg>
                </span>
                <h3 className="mt-6 text-title text-ink">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{c.body}</p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* 7 · CTA */}
      {showApply && (
        <section className="py-20 max-[640px]:py-14">
          <PageContainer>
            <div className="relative overflow-hidden rounded-card bg-ink p-14 max-[640px]:px-6 max-[640px]:py-9">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full"
                style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)' }}
              />
              <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <Eyebrow dark>Ready to join?</Eyebrow>
                  <h2 className="font-brand mt-4 text-section-title text-bg-card">
                    Applications reviewed in five business days.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">
                    Every application is personally reviewed. If accepted, your profile goes live within two weeks and
                    clients can find you from day one.
                  </p>
                </div>
                <Button href="/apply" variant="secondary-dark" className="flex-none">
                  Apply for membership
                  <Arrow />
                </Button>
              </div>
            </div>
          </PageContainer>
        </section>
      )}
    </div>
  );
}
