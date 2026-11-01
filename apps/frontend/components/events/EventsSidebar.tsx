import { Button, Card } from '@/components/ui';
import { SidebarJoinCard, SidebarStatsCard } from '@/components/shared/SidebarCards';

// Same card set as the member directory's sidebar. "Suggest an event" is a mailto: link — there's
// no submission backend yet.
export function EventsSidebar({ upcomingCount, showApply = true }: { upcomingCount: number; showApply?: boolean }) {
  const stats = [
    {
      num: upcomingCount.toLocaleString('en-GB'),
      label: (
        <>
          <b className="font-medium text-ink">Upcoming events</b>: conferences, seminars, webinars and workshops.
        </>
      ),
    },
    {
      num: '3',
      label: (
        <>
          <b className="font-medium text-ink">Formats</b>: in person, hybrid and online, so you can join from anywhere.
        </>
      ),
    },
    {
      num: '100%',
      label: (
        <>
          <b className="font-medium text-ink">Curated</b>: every listing is reviewed by the GrowXQ team before it goes
          live.
        </>
      ),
    },
  ];

  return (
    <aside className="flex flex-col gap-4">
      <SidebarStatsCard
        title="Events worth your time."
        intro="Only events relevant to finance and legal professionals make the calendar."
        stats={stats}
      />

      <Card padding="md">
        <h3 className="text-title text-ink">Know of one we&apos;re missing?</h3>
        <p className="mt-2 text-sm text-ink-3">
          Running or attending something relevant? Send us the details and our team will review it for the calendar.
        </p>
        <Button
          href="mailto:contact@growxq.com?subject=Event%20suggestion"
          variant="secondary"
          className="mt-4"
          fullWidth
        >
          Suggest an event →
        </Button>
      </Card>

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
