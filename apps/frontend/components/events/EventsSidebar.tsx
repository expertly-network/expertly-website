import { Button, Card } from '@/components/ui';
import { SidebarDarkCard, SidebarJoinCard, SidebarStatsCard } from '@/components/shared/SidebarCards';
import type { EventStatsResponse } from '@shared/event';

// Same card set as the member directory's sidebar. "Suggest an event" is a mailto: link — there's
// no submission backend yet.
export function EventsSidebar({ stats, showApply = true }: { stats: EventStatsResponse | null; showApply?: boolean }) {
  // Live figures from GET /v1/events/stats (published events that haven't ended yet).
  const figures = stats
    ? [
        {
          num: stats.upcoming.toLocaleString('en-GB'),
          label: (
            <>
              <b className="font-medium text-ink">Upcoming events</b>: conferences, seminars, webinars and workshops.
            </>
          ),
        },
        {
          num: stats.countries.toLocaleString('en-GB'),
          label: (
            <>
              <b className="font-medium text-ink">Countries</b> hosting them in person, plus events you can join online.
            </>
          ),
        },
        {
          num: stats.organisers.toLocaleString('en-GB'),
          label: (
            <>
              <b className="font-medium text-ink">Organisers</b>: professional bodies, firms and institutes running
              them.
            </>
          ),
        },
      ]
    : [];

  return (
    <aside className="flex flex-col gap-4">
      <SidebarStatsCard
        title="Events worth your time."
        intro="Only events relevant to finance and legal professionals make the calendar."
        stats={figures}
      />

      {/* The last card is always the dark one: this card takes that role when the apply card is hidden. */}
      <SuggestEventCard dark={!showApply} />

      {showApply && (
        <SidebarJoinCard
          eyebrow="For members"
          title="Get early access to events."
          body="GrowXQ members receive early-bird notifications and introductions to event organisers."
        />
      )}
    </aside>
  );
}

function SuggestEventCard({ dark }: { dark: boolean }) {
  const body = (
    <>
      <h3 className={`text-title ${dark ? 'text-bg-card' : 'text-ink'}`}>Know of one we&apos;re missing?</h3>
      <p className={`mt-2 text-sm ${dark ? 'text-white/60' : 'text-ink-3'}`}>
        Running or attending something relevant? Send us the details and our team will review it for the calendar.
      </p>
      <Button
        href="mailto:contact@growxq.com?subject=Event%20suggestion"
        variant={dark ? 'secondary-dark' : 'secondary'}
        className="mt-4"
        fullWidth
      >
        Suggest an event →
      </Button>
    </>
  );
  return dark ? <SidebarDarkCard>{body}</SidebarDarkCard> : <Card padding="md">{body}</Card>;
}
