import { Button, Card } from '@/components/ui';

// Matches design/static_html/events.html's right rail: curated-calendar blurb (no stats block —
// the design dropped the 50+/20+/2 stat list this app previously had at some point since it was
// last built, per the "sidebar has been updated in the design" feedback), a "Suggest an event"
// card, and a membership CTA. "Suggest an event" is a mailto: link, not a form — there's no
// public suggestion-queue write endpoint yet (docs/rest-api.md's Events "not built yet"), so
// this is a real action (opens the user's mail client) rather than a form with nowhere to go.
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
        {/* Matches design's `.ev-sidebar-cta::before` — soft accent-tinted circle bleeding off
            the top-right corner, same technique as ArticleNewsletterCard/AuthRightPanel. */}
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
