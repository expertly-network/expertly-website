import { MEMBERSHIP_TIERS } from '@/lib/members/tiers';
import { Button } from '@/components/ui';
import { TierBadge } from '@/components/members/TierBadge';
import { SidebarDarkCard, SidebarJoinCard, SidebarStatsCard } from '@/components/shared/SidebarCards';

const STATS = [
  {
    num: '100%',
    label: (
      <>
        <b className="font-medium text-ink">Manual review</b>: every profile is personally verified by our team before
        going live.
      </>
    ),
  },
  {
    num: '0',
    label: (
      <>
        <b className="font-medium text-ink">Junior associates</b>: every member is a partner-level, senior, or founder
        practitioner.
      </>
    ),
  },
  {
    num: '20+',
    label: (
      <>
        <b className="font-medium text-ink">Jurisdictions</b> covered: from Chennai and Singapore to London, Dubai, and
        New York.
      </>
    ),
  },
];

// Static trust-signal marketing copy, not data.
export function DirectorySidebar({ showApply = true }: { showApply?: boolean }) {
  return (
    <aside className="sticky top-6 flex flex-col gap-4 max-[1023px]:static max-[1023px]:order-first max-[639px]:order-none">
      <SidebarStatsCard
        title="Every member is individually vetted."
        intro="Our screening covers credentials, years in practice, jurisdiction expertise, and a peer review by existing members. No self-serve listings."
        stats={STATS}
      />
      <section className="rounded-card border border-line bg-bg-card p-6" aria-labelledby="directory-tiers-title">
        <h3 id="directory-tiers-title" className="text-title text-ink">
          Membership Tier
        </h3>
        <dl className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3">
          {MEMBERSHIP_TIERS.map((tier) => (
            <div key={tier.key} className="contents">
              <dt>
                <TierBadge tier={tier.key} size="md" />
              </dt>
              <dd className="text-sm text-ink-3">{tier.summary}</dd>
            </div>
          ))}
        </dl>
      </section>
      {/* The last card is always the dark one: members and admins can't apply, so they get a referral
          card instead. A mailto: link, like the events page's "Suggest an event" — no referral backend. */}
      <div className="max-[859px]:hidden">
        {showApply ? (
          <SidebarJoinCard
            eyebrow="For practitioners"
            title="Join the network."
            body="Apply for membership and get discovered by clients globally. Keep 100% of your fees."
          />
        ) : (
          <SidebarDarkCard>
            <h3 className="text-title text-bg-card">Know a practitioner who belongs here?</h3>
            <p className="mt-2 text-sm text-white/60">
              Send us their details and our team will reach out to them about membership.
            </p>
            <Button
              href="mailto:ask@growxq.com?subject=Member%20referral"
              variant="secondary-dark"
              className="mt-4"
              fullWidth
            >
              Refer a practitioner →
            </Button>
          </SidebarDarkCard>
        )}
      </div>
    </aside>
  );
}
