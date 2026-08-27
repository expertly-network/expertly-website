import { Card, Button } from '@/components/ui';

const STATS = [
  {
    num: '100%',
    label: (
      <>
        <b className="font-medium text-ink">Manual review</b>: every profile is personally
        verified by our team before going live.
      </>
    ),
  },
  {
    num: '0',
    label: (
      <>
        <b className="font-medium text-ink">Junior associates</b>: every member is a
        partner-level, senior, or founder practitioner.
      </>
    ),
  },
  {
    num: '20+',
    label: (
      <>
        <b className="font-medium text-ink">Jurisdictions</b> covered: from Chennai and Singapore
        to London, Dubai, and New York.
      </>
    ),
  },
];

// Static trust-signal marketing copy, ported verbatim from
// design/static_html/members.html's sidebar (`.mv4-sidebar`) — not data, no fetch needed.
// `sticky top-6` matches `.mv4-sidebar { position: sticky; top: 24px }` exactly; each stat is
// a horizontal row (accent-green number, fixed-width column + text alongside it), not a
// stacked number-then-caption block.
export function DirectorySidebar() {
  return (
    <aside className="sticky top-6 flex flex-col gap-4 max-[1023px]:static max-[1023px]:order-first">
      <Card padding="md">
        <h3 className="text-title text-ink">Every member is individually vetted.</h3>
        <p className="mt-3 text-sm text-ink-3">
          Our screening covers credentials, years in practice, jurisdiction expertise, and a peer
          review by existing members. No self-serve listings.
        </p>
        <div className="mt-2">
          {STATS.map((stat) => (
            <div key={stat.num} className="flex items-start gap-3 border-t border-line py-3.5">
              <div className="w-14 flex-none text-[26px] font-semibold leading-none tracking-[-0.03em] text-accent">
                {stat.num}
              </div>
              <p className="text-[13px] leading-[1.45] text-ink-3">{stat.label}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card padding="md" className="relative overflow-hidden bg-ink max-[859px]:hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--accent) 18%, transparent) 0%, transparent 70%)',
          }}
        />
        <span className="relative font-mono text-[9px] font-bold tracking-[0.14em] text-white/40">
          FOR PRACTITIONERS
        </span>
        <h3 className="relative mt-2 text-title text-bg-card">Join the network.</h3>
        <p className="relative mt-2 text-sm text-white/60">
          Apply for membership and get discovered by clients globally. Keep 100% of your fees.
        </p>
        <Button href="/apply" variant="secondary-dark" className="relative mt-4" fullWidth>
          Apply for membership →
        </Button>
      </Card>
    </aside>
  );
}
