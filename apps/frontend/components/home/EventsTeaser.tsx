import { Button, Card, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { EventsCalendar } from '@/components/home/EventsCalendar';
import type { EventDto } from '@shared/event';

// Real upcoming/published events (GET /v1/events) rendered in the actual interactive
// month-calendar widget (EventsCalendar) design/static_html/index.html uses — falls back to
// an honest "coming soon" placeholder rather than fabricated data if the list is ever empty.
export function EventsTeaser({ events }: { events: EventDto[] }) {
  return (
    <section className="border-b border-line py-24">
      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Calendar</Eyebrow>
            <h2 className="mt-4 text-section-title text-ink">
              Be part of what&apos;s <span className="text-accent">next</span>
            </h2>
            <p className="mt-4 max-w-xl text-lede text-ink-3">
              From tax briefings in Dubai to M&amp;A roundtables in London — the conferences and
              summits our members actually show up.
            </p>
          </div>
          <Button href="/events" variant="secondary">
            All events
          </Button>
        </div>
        <div className="mt-8">
          {events.length > 0 ? (
            <EventsCalendar events={events} />
          ) : (
            <Card padding="lg" className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-ink">Events are coming soon.</p>
              <p className="max-w-md text-sm text-ink-3">
                We&apos;re building out a calendar of conferences, meetups, and member-exclusive
                sessions. Check back shortly.
              </p>
            </Card>
          )}
        </div>
      </PageContainer>
    </section>
  );
}
