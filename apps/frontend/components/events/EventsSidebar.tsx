import { Button, Card } from '@/components/ui';

// "Suggest an event" is a mailto: link — there's no submission backend yet.
export function EventsSidebar() {
  return (
    <div className="flex flex-col gap-6">
      <Card padding="md">
        <div className="mb-1 text-mono-label text-ink-3">Curated calendar</div>
        <h3 className="mt-2 text-title text-ink">Events worth your time.</h3>
        <p className="mt-2 text-sm text-ink-3">
          Only conferences and summits relevant to finance and legal professionals make the
          list, personally reviewed by the Expertly team.
        </p>
      </Card>

      <Card padding="md">
        <div className="mb-1 text-mono-label text-ink-3">Know of one we&apos;re missing?</div>
        <h3 className="mt-2 text-title text-ink">Suggest an event.</h3>
        <p className="mt-2 text-sm text-ink-3">
          Running or attending something relevant? Send us the details and our team will review
          it for the calendar.
        </p>
        <Button
          href="mailto:contact@expertly.global?subject=Event%20suggestion"
          variant="secondary"
          className="mt-4"
        >
          Suggest an event →
        </Button>
      </Card>

      <Card padding="md" className="relative overflow-hidden bg-ink">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
          style={{
            background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="mb-1 text-mono-label text-white/50">For members</div>
          <h3 className="mt-2 text-title text-bg-card">Get early access to events.</h3>
          <p className="mt-2 text-sm text-white/60">
            Expertly members receive early-bird notifications and introductions to event
            organisers.
          </p>
          <Button href="/apply" variant="secondary-dark" className="mt-4">
            Apply for membership →
          </Button>
        </div>
      </Card>
    </div>
  );
}
