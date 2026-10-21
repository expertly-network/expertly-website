import { getSessionUser } from '@/lib/auth/session-claims';
import { canApplyForMembership } from '@/lib/auth/roles';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Card, Eyebrow } from '@/components/ui';

export const metadata = {
  title: 'Membership benefits — Expertly',
  description:
    'One flat annual fee: client discovery, unlimited publishing, a vetted peer network and member events — with zero commission on any work you win.',
};

// Adapted from design/static_html/membership.html. Deliberately drops the prototype's invented
// live numbers ("142 members online now", "847 views this week", a $699 anchor price, a monthly
// plan) — pricing is the real annual-only MEMBERSHIP_PRICE_CENTS, and features that aren't live
// yet say so instead of being sold as available.

const INCLUDED = [
  'Verified profile & discovery listing',
  'Client consultation requests direct to you',
  'Unlimited article publishing',
  'Member-only events access',
  'Peer network across 20+ jurisdictions',
  'Zero commission on any work you win',
];

const PILLARS: { n: string; title: string; body: string; stats: [string, string][]; soon?: boolean }[] = [
  {
    n: '01 · Client Discovery',
    title: 'Stop chasing leads. Start choosing them.',
    body: 'Clients search Expertly by practice area and jurisdiction — in plain English. Your verified profile surfaces when they do. No bidding wars, no agency cut, no cold outreach: consultation requests come straight to you.',
    stats: [
      ['$0', 'Commission charged'],
      ['100%', 'Fees kept by you'],
      ['Direct', 'Client-to-you contact'],
    ],
  },
  {
    n: '02 · Thought Leadership',
    title: 'Publish once. Get discovered for years.',
    body: 'A sharp take on regulatory change is why a client calls you instead of the firm next door. Every article you publish becomes a permanent, searchable asset under your name — written yourself, or drafted with Expertly AI from your own notes.',
    stats: [
      ['Unlimited', 'Articles'],
      ['Searchable', 'By clients, in plain English'],
      ['Yours', 'Always under your name'],
    ],
  },
  {
    n: '03 · Peer Network',
    title: 'Peers who have actually been in your seat.',
    body: 'Every member is individually vetted, so a conversation here is worth your time. Trade referrals on work outside your scope, get a second opinion on a cross-border matter, or recommend a peer whose work you know.',
    stats: [
      ['Vetted', 'Every single member'],
      ['1:1', 'Direct, no platform in between'],
    ],
  },
  {
    n: '04 · Exclusive Events',
    title: 'In the room with the right people.',
    body: 'A curated calendar of conferences and summits relevant to finance and legal practitioners, reviewed by the Expertly team — plus member-only roundtables as the network grows.',
    stats: [
      ['Curated', 'By practice & jurisdiction'],
      ['Global', 'Financial centres'],
    ],
  },
  {
    n: '05 · Perks & Product Discounts',
    title: 'Deals on the tools your practice runs on.',
    body: 'Partner discounts on research, AI, finance and productivity tools, applied to your membership automatically.',
    stats: [['Growing', 'New partners each quarter']],
    soon: true,
  },
  {
    n: '06 · Community Discussions',
    title: 'Ask. Answer. Learn — with people who know.',
    body: 'Topic-based discussion groups (international tax, M&A, GST, corporate law, capital markets and more) where every reply comes from a verified practitioner.',
    stats: [['Verified', 'Every respondent']],
    soon: true,
  },
];

const STEPS: [string, string, string][] = [
  ['Apply', 'Connect LinkedIn, then submit your practice details, services and two peer references. About 10 minutes.', '10 min'],
  ['Verify', 'Our team reviews your credentials and contacts your references.', '~5 business days'],
  ['Onboard', 'Your profile goes live. Set your rates and availability, and publish your first article.', 'On approval'],
  ['Grow', 'Clients find you through AI search, the member directory and your articles.', 'From day one'],
];

const CHECKS: [string, string][] = [
  ['Identity & credentials', 'Every applicant connects a real LinkedIn account, and the details submitted at onboarding are checked by the Expertly team before a profile goes live.'],
  ['Peer references', 'Two professional references are contacted as part of every application — regardless of seniority.'],
  ['Proof-backed details', 'Key engagements, clients, testimonials and awards added later carry a Verified badge only when backed by proof the team has reviewed.'],
  ['Ongoing review', 'Verification is not a one-time exercise — facts and conduct are reviewed on an ongoing basis to keep the badge meaningful.'],
];

function Check() {
  return (
    <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
      ✓
    </span>
  );
}

export default async function MembershipPage() {
  const user = await getSessionUser();
  const showApply = canApplyForMembership(user);

  return (
    <div>
      <section className="relative overflow-hidden bg-ink py-20 max-[640px]:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full"
          style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)' }}
        />
        <PageContainer className="relative grid items-center gap-10 lg:grid-cols-[1fr_400px]">
          <div>
            <Eyebrow dark>Expertly Membership</Eyebrow>
            <h1 className="mt-5 text-headline text-bg-card">
              Everything you need to grow your practice, without giving up a{' '}
              <span className="text-accent">cut</span> of what you earn.
            </h1>
            <p className="mt-5 max-w-2xl text-lede text-white/60">
              A single flat annual fee unlocks client discovery, unlimited publishing and member
              events — with zero commission taken on any work you win.
            </p>
            {showApply && (
              <Button href="/apply" variant="accent" className="mt-8">
                Apply for membership →
              </Button>
            )}
          </div>

          <Card padding="lg" className="w-full">
            <div className="text-mono-label text-ink-3">Included in every membership</div>
            <ul className="mt-5 flex flex-col gap-3 text-sm text-ink-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line pt-5">
              <div className="text-stat text-ink">
                $499<span className="text-caption text-ink-3"> / year</span>
              </div>
              <p className="mt-1 text-caption text-ink-3">Flat fee · no commission, ever</p>
            </div>
          </Card>
        </PageContainer>
      </section>

      <section className="border-b border-line py-20 max-[640px]:py-14">
        <PageContainer className="flex flex-col gap-6">
          {PILLARS.map((p) => (
            <Card key={p.n} padding="xl" className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-mono-label text-accent">{p.n}</span>
                  {p.soon && (
                    <span className="rounded-full bg-bg-alt px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-ink-3">
                      Coming soon
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-heading text-ink">{p.title}</h2>
                <p className="mt-4 max-w-2xl text-[15px] leading-[1.65] text-ink-3">{p.body}</p>
              </div>
              <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-5 border-line max-lg:border-t max-lg:pt-6 lg:border-l lg:pl-8">
                {p.stats.map(([value, label]) => (
                  <div key={label}>
                    <dt className="sr-only">{label}</dt>
                    <dd className="text-title text-ink">{value}</dd>
                    <dd className="mt-1 text-caption text-ink-3">{label}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </PageContainer>
      </section>

      <section className="border-b border-line py-20 max-[640px]:py-14">
        <PageContainer>
          <Eyebrow>How to join</Eyebrow>
          <h2 className="mt-4 text-section-title text-ink">
            Joining is simple. <span className="text-ink-4">Here&apos;s exactly how it works.</span>
          </h2>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body, time], i) => (
              <li key={title}>
                <Card padding="lg" className="h-full">
                  <span className="text-mono-label text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-4 text-title text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">{body}</p>
                  <p className="mt-4 text-caption font-medium text-ink-2">{time}</p>
                </Card>
              </li>
            ))}
          </ol>
        </PageContainer>
      </section>

      <section className="border-b border-line py-20 max-[640px]:py-14">
        <PageContainer>
          <Eyebrow>Why members trust the badge</Eyebrow>
          <h2 className="mt-4 text-section-title text-ink">
            One verification standard. <span className="text-ink-4">No exceptions.</span>
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {CHECKS.map(([title, body]) => (
              <Card key={title} padding="lg">
                <h3 className="text-title text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{body}</p>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      {showApply && (
        <section className="py-20 max-[640px]:py-14">
          <PageContainer>
            <Card padding="xl" className="flex flex-col items-start gap-6 bg-ink lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-heading text-bg-card">Ready to join?</h2>
                <p className="mt-2 max-w-xl text-sm text-white/60">
                  Every application is personally reviewed, usually within five business days.
                </p>
              </div>
              <Button href="/apply" variant="secondary-dark">
                Apply for membership →
              </Button>
            </Card>
          </PageContainer>
        </section>
      )}
    </div>
  );
}
