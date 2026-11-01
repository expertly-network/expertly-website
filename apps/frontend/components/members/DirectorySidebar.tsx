import { SidebarJoinCard, SidebarStatsCard } from '@/components/shared/SidebarCards';

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
    <aside className="sticky top-6 flex flex-col gap-4 max-[1023px]:static max-[1023px]:order-first">
      <SidebarStatsCard
        title="Every member is individually vetted."
        intro="Our screening covers credentials, years in practice, jurisdiction expertise, and a peer review by existing members. No self-serve listings."
        stats={STATS}
      />
      {showApply && (
        <div className="max-[859px]:hidden">
          <SidebarJoinCard
            eyebrow="For practitioners"
            title="Join the network."
            body="Apply for membership and get discovered by clients globally. Keep 100% of your fees."
          />
        </div>
      )}
    </aside>
  );
}
