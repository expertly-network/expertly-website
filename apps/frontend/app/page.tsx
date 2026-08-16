import { SiteShell } from '@/components/layout/SiteShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FaqGroup } from '@/components/home/Faq';
import { StellarOrbitHero } from '@/components/home/StellarOrbitHero';
import { FeaturedMembers } from '@/components/home/FeaturedMembers';
import { PracticeAreasMarquee } from '@/components/home/PracticeAreasMarquee';
import { FirmsBand } from '@/components/home/FirmsBand';
import { LatestArticles } from '@/components/home/LatestArticles';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import { Testimonials } from '@/components/home/Testimonials';

// Real homepage, replacing the BackendConnectivityCheck dev scaffold. Section order and
// content match design/static_html/index.html section-for-section (hero → AI search →
// featured members → practice areas → firms → articles → events → testimonials → dual CTA →
// newsletter → FAQ). Member/article/event/practice-area content is the prototype's own seed
// data (lib/design-seed-data.ts, ported verbatim from assets/members.js) — there's no Member
// Directory or Articles-frontend backend yet (docs/build-prompts.md), so this is what the
// design itself actually renders, not a placeholder standing in for it.
//
// Remaining deliberate deviations (documented, not silent):
// - Hero: see components/home/StellarOrbitHero.tsx's own header for what's simplified within it.
// - Events: the design's real widget is a full interactive month-calendar grid
//   (.home-calendar); components/home/UpcomingEvents.tsx is a simpler card list of the same
//   real event data — see that file's own comment.
// - Newsletter: dropped the region/country multi-select jurisdiction picker — plain email
//   capture only, and the form doesn't submit anywhere (no backend yet, session 16) —
//   disabled rather than faking a submission.
// - AI search panel: static, non-interactive (real one is a live search-as-you-type
//   experience with no backend yet — global search is session 16, lowest priority).
// - All /members, /articles/[id], /events links point at routes that don't exist yet
//   (sessions 2, 5, 11) — inert until then, same as the rest of this page.

const FAQ_MEMBERSHIP = [
  {
    q: 'Who can join Expertly?',
    a: 'Expertly is open to all practising finance and legal professionals across the world. Whether you are an independent practitioner or part of a firm, if you are serious about your practice and looking for a trusted network of verified peers to collaborate, share knowledge, and grow across borders — Expertly is the right place for you.',
  },
  {
    q: 'How are members onboarded?',
    a: 'Every member goes through a robust selection process before being onboarded and listed in the directory. We review professional credentials, years of experience, and areas of specialisation, and take feedback from fellow professionals before granting membership. The process typically takes 5 to 7 business days from application to approval.',
  },
  {
    q: 'What does membership cost?',
    a: 'Membership is a flat $499/year, with zero commission on any work you win. Occasionally, we offer promotional discount codes for new members.',
  },
  {
    q: 'Can I publish articles on Expertly?',
    a: 'Yes — members can publish articles through the member portal, helping you build your professional brand and reach a targeted audience of peers and potential clients.',
  },
];

const FAQ_CLIENTS = [
  {
    q: 'Is Expertly free to browse?',
    a: 'Yes. Anyone can browse the member directory, view article headlines, and view event headlines without signing up. Full contact details of members, consultation requests, and full article and event details require a free account.',
  },
  {
    q: 'What is the difference between a User and a Member?',
    a: 'A User is a person who has created a free account but is not a member — they can view member contact details, place consultation requests, and read full articles, but cannot post a profile or write articles. A Member can create a profile, be searchable on the platform, and write articles.',
  },
  {
    q: 'Can I request a consultation with a member?',
    a: 'Yes. Registered users and members can send consultation requests directly to any member. Members set their own availability and fee range, so you always know what to expect upfront.',
  },
  {
    q: 'What does the Verified badge actually mean?',
    a: "The Verified badge is awarded only to profiles we've manually reviewed and approved — covering professional credentials, qualifications, and years of experience as declared in the member's profile.",
  },
];

export default function Home() {
  return (
    <SiteShell>
      <StellarOrbitHero />

      {/* AI search — pale-mint full-bleed section, matching the real rendered design (not
          just its CSS source, which undersold how prominent this panel actually is) */}
      <section className="border-b border-line bg-bg-alt px-6 py-20">
        <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-eyebrow text-accent">Expertly · Intelligent Discovery</span>
            <h2 className="mt-4 text-section-title text-ink">
              Ask in plain English. Get <span className="text-accent">exactly</span> who & what
              you need.
            </h2>
            <p className="mt-5 max-w-[480px] text-sm text-ink-3">
              One query searches the entire network at once, no filters to fiddle with, no
              jargon required. Describe the matter and Expertly search surfaces the right
              people, the relevant reading, and the events worth your time.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-sm text-ink-2">
              <li>
                <span className="text-accent">✓</span> <strong>Verified experts</strong>, matched
                by practice, jurisdiction & rate
              </li>
              <li>
                <span className="text-accent">✓</span> <strong>Articles & insights</strong>,
                peer-reviewed analysis on point
              </li>
              <li>
                <span className="text-accent">✓</span> <strong>Upcoming events</strong>,
                conferences and meetings that fit
              </li>
            </ul>
            <Button className="mt-8">Try Expertly →</Button>
          </div>
          <Card padding="md" className="!p-0">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
              <span aria-hidden="true" className="text-accent">⌕</span>
              <span className="flex-1 text-[15px] text-ink">M&A tax advisor in Singapore under $500/hr</span>
              <span className="rounded-full border border-line-2 bg-bg-alt px-2 py-1 text-[10px] font-medium text-ink-3">
                Click to type
              </span>
            </div>
            <div className="flex h-[280px] items-center justify-center px-5 text-xs text-ink-3">
              Live search is coming with the Member Directory (see docs/build-prompts.md
              session 5).
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[11px] text-ink-3">
              <div className="flex gap-3">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>esc close</span>
              </div>
              <span>Powered by Expertly</span>
            </div>
          </Card>
        </div>
      </section>

      {/* Featured members — split layout, panel on the left (design's "split-feature reverse") */}
      <section className="border-b border-line px-6 py-20">
        <div className="mx-auto grid max-w-[1150px] gap-12 lg:grid-cols-2 lg:items-center">
          <div className="order-2 overflow-hidden rounded-3xl bg-bg-alt py-6 lg:order-1">
            <FeaturedMembers />
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-eyebrow text-accent">Our network</span>
            <h2 className="mt-4 text-section-title text-ink">
              A specialist network of <span className="text-accent">verified</span> practitioners.
            </h2>
            <p className="mt-5 text-sm text-ink-3">
              Every member is credential-verified and peer-reviewed before they join — no junior
              associates, no middlemen.
            </p>
            <Button href="/members" className="mt-7">
              Browse all members
            </Button>
          </div>
        </div>
      </section>

      {/* Practice areas — split layout, panel on the right (design's plain "split-feature") */}
      <section className="border-b border-line px-6 py-20">
        <div className="mx-auto grid max-w-[1150px] gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-eyebrow text-accent">Coverage</span>
            <h2 className="mt-4 text-section-title text-ink">
              <span className="text-accent">Specialists</span> across every corner of finance & law.
            </h2>
            <Button href="/members" className="mt-7">
              Explore all practice areas
            </Button>
          </div>
          <div className="overflow-hidden rounded-3xl bg-bg-alt py-6">
            <PracticeAreasMarquee />
          </div>
        </div>
      </section>

      {/* Firms band */}
      <section className="border-b border-line bg-ink py-20">
        <div className="mx-auto max-w-[1150px] px-6">
          <span className="text-eyebrow text-white/55">Where our members practice</span>
          <h2 className="mt-3.5 max-w-[760px] text-section-title text-bg-card">
            Senior professionals from firms that <span className="text-accent">set the standard.</span>
          </h2>
        </div>
        <div className="mt-10">
          <FirmsBand />
        </div>
      </section>

      {/* Latest articles */}
      <section className="border-b border-line px-6 py-20">
        <div className="mx-auto max-w-[1150px]">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-eyebrow text-accent">Knowledge base</span>
              <h2 className="mt-4 text-section-title text-ink">
                Latest <span className="text-accent">articles</span>
              </h2>
            </div>
            <Button href="/articles" variant="secondary">
              View all
            </Button>
          </div>
          <div className="mt-8">
            <LatestArticles />
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="border-b border-line px-6 py-20">
        <div className="mx-auto max-w-[1150px]">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-eyebrow text-accent">Calendar</span>
              <h2 className="mt-4 text-section-title text-ink">
                Be part of what&apos;s <span className="text-accent">next</span>
              </h2>
            </div>
            <Button href="/events" variant="secondary">
              All events
            </Button>
          </div>
          <div className="mt-8">
            <UpcomingEvents />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b border-line px-6 py-20">
        <div className="mx-auto max-w-[1150px]">
          <span className="text-eyebrow text-accent">Voices</span>
          <h2 className="mt-4 text-section-title text-ink">
            <span className="text-accent">Trusted</span> by professionals worldwide.
          </h2>
          <div className="mt-8">
            <Testimonials />
          </div>
        </div>
      </section>

      {/* Dual CTA — copy taken verbatim from the design */}
      <section className="border-b border-line px-6 py-20">
        <div className="mx-auto max-w-[1150px]">
          <span className="text-eyebrow text-accent">Two ways in</span>
          <h2 className="mt-4 text-section-title text-ink">
            One <span className="text-accent">platform</span>. Two powerful paths.
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Card padding="md">
              <div className="text-mono-label text-ink-3">For Clients & Businesses</div>
              <h3 className="mt-3 text-title text-ink">
                Find the right <span className="text-accent">expert</span>. Fast.
              </h3>
              <ul className="mt-5 flex flex-col gap-2.5 text-sm text-ink-2">
                <li>✓ Browse 18+ vetted finance & legal professionals</li>
                <li>✓ Read expert articles on tax, law, M&amp;A, compliance</li>
                <li>✓ Request consultations directly, no middlemen</li>
                <li>✓ Transparent rates upfront before you commit</li>
              </ul>
              <Button href="/members" className="mt-7">
                Browse members
              </Button>
            </Card>
            <Card padding="md" className="bg-ink text-bg">
              <div className="text-mono-label text-white/60">For Finance & Legal Pros</div>
              <h3 className="mt-3 text-title text-bg">
                Build your professional <span className="text-neon">presence</span>.
              </h3>
              <ul className="mt-5 flex flex-col gap-2.5 text-sm text-white/80">
                <li>✓ Get discovered by clients globally</li>
                <li>✓ Publish articles, establish authority</li>
                <li>✓ Exclusive events with verified peers</li>
                <li>✓ Set your rates, keep 100% of fees</li>
              </ul>
              <Button href="/apply" variant="secondary" className="mt-7 !bg-bg !text-ink">
                Apply for membership
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Newsletter — plain email capture, no jurisdiction picker, no backend yet */}
      <section className="border-b border-line px-6 py-20">
        <Card padding="lg" className="mx-auto max-w-[720px] bg-ink text-center text-bg">
          <span className="text-eyebrow text-white/60">The Expertly brief · weekly</span>
          <h2 className="mt-4 text-section-title text-bg">
            Regulatory changes. New members. Case studies.
          </h2>
          <p className="mt-2 text-sm text-white/60">One email, every Thursday.</p>
          <form className="mx-auto mt-7 flex max-w-[420px] gap-2">
            <input
              type="email"
              placeholder="you@firm.com"
              disabled
              title="Newsletter subscriptions aren't live yet (docs/build-prompts.md session 16)"
              className="w-full rounded-input border border-white/20 bg-white/10 px-3.5 py-3 text-sm text-bg placeholder:text-white/40"
            />
            <Button variant="secondary" disabled className="!bg-bg !text-ink">
              Subscribe
            </Button>
          </form>
        </Card>
      </section>

      {/* FAQ — copy verbatim from the design, real accordion behavior */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-[1150px]">
          <span className="text-eyebrow text-accent">Questions</span>
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
        </div>
      </section>
    </SiteShell>
  );
}
