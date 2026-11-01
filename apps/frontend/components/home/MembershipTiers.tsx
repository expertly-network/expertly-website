import { Button, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { MEMBER_TIER_LABEL } from '@/lib/members/format';

// Home page "Who can join" section, right after the "Two ways in" cards: the two tiers pitched to
// the professionals they're for, the 5-year minimum stated plainly, and how membership is earned
// (verification). Tier ranges match the backend's computed tier (>12 years = Seasoned); the ops
// team can change it at approval, hence "as a guide".

const TIERS = [
  {
    label: MEMBER_TIER_LABEL.budding_entrepreneur,
    range: '5–12 years',
    badgeClass: 'border-line bg-bg-alt text-ink-2',
    title: (
      <>
        Your work speaks louder than your <span className="text-accent">years</span>.
      </>
    ),
    points: [
      'Be judged on the quality of your work, not the length of your CV',
      'A verified profile clients can trust from the first click',
      'Publish, get discovered and build your name early',
    ],
  },
  {
    label: MEMBER_TIER_LABEL.seasoned_professional,
    range: '12+ years',
    badgeClass: 'border-warn-line bg-warn-soft text-warn',
    title: (
      <>
        A career&apos;s worth of expertise, <span className="text-accent">recognised</span>.
      </>
    ),
    points: [
      'The Seasoned Professional badge, earned and shown beside your name',
      'Sit alongside partners, founders and heads of practice',
      'A peer network at your level, across 20+ jurisdictions',
    ],
  },
];

const STEPS = [
  {
    num: '01',
    title: 'You apply',
    body: 'Tell us what you have done, where you have done it, and the services you do best.',
  },
  {
    num: '02',
    title: 'We verify every detail',
    body: 'Identity, work history, qualifications and credentials, checked one by one. Where it matters, we speak to your references.',
  },
  {
    num: '03',
    title: 'We approve, by service',
    body: 'Only for the services that are genuinely your expertise. Your tier is confirmed on your track record, not just your years.',
  },
  {
    num: '04',
    title: 'You go live',
    body: 'Your verified profile joins the directory, tier beside your name, alongside members held to the same standard.',
  },
];

export function MembershipTiers() {
  return (
    <section className="border-b border-line bg-bg-alt py-24">
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
          <div>
            <Eyebrow>Who Can Join</Eyebrow>
            <h2 className="font-brand mt-4 text-section-title text-ink">
              Not everyone gets in. <span className="text-accent">That&apos;s the point.</span>
            </h2>
          </div>
          <p className="text-lede text-ink-3">
            GrowXQ is for practising finance and legal professionals with five or more years of experience. Every member
            is verified before they&apos;re listed, so whoever you find here, you can trust.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          {TIERS.map((tier) => (
            <div
              key={tier.label}
              className="flex flex-col rounded-card border border-line bg-bg-card p-10 max-[720px]:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded-full border px-2.5 py-[3px] font-mono text-[11px] font-semibold ${tier.badgeClass}`}
                >
                  {tier.label}
                </span>
                <span className="text-caption text-ink-3">{tier.range}, as a guide</span>
              </div>
              <h3 className="font-brand mt-6 text-heading text-ink">{tier.title}</h3>
              <ul className="mt-6 flex flex-col gap-3 text-[15px] text-ink-2">
                {tier.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 flex-none text-accent">
                      ✓
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-caption text-ink-3">
          Years are a guide: our team confirms every tier on track record. Under five years of experience? We don&apos;t
          accept applications below that.
        </p>

        <div className="mt-16">
          <h3 className="font-brand text-heading text-ink">
            Membership is <span className="text-accent">earned</span>, not bought.
          </h3>
          <p className="mt-3 max-w-2xl text-[15px] text-ink-3">
            We verify every detail you give us. Filling in the form never makes anyone a member: each application is
            checked by our operations team, so everyone who joins clears the same high bar.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.num} className="rounded-2xl border border-line bg-bg-card p-6">
                <span className="text-stat text-accent">{step.num}</span>
                <p className="mt-3 text-sm font-semibold text-ink">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{step.body}</p>
              </li>
            ))}
          </ol>
          <Button href="/membership" className="mt-10">
            See membership benefits →
          </Button>
        </div>
      </PageContainer>
    </section>
  );
}
