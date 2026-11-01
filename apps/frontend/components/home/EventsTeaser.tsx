import { Button, Eyebrow } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { EventsCalendar } from '@/components/home/EventsCalendar';
import type { EventCalendarResponse, EventDto } from '@shared/event';

// Falls back to a "coming soon" placeholder if there are no events yet.
export function EventsTeaser({ calendar, upcoming }: { calendar: EventCalendarResponse; upcoming: EventDto[] }) {
  return (
    <section className="border-b border-line py-24">
      <PageContainer>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Calendar</Eyebrow>
            <h2 className="font-brand mt-4 text-section-title text-ink">
              Be part of what&apos;s <span className="text-accent">next</span>
            </h2>
            <p className="mt-4 max-w-xl text-lede text-ink-3">
              From tax briefings in Dubai to M&amp;A roundtables in London — the conferences and summits our members
              actually show up.
            </p>
          </div>
          <Button href="/events" variant="secondary">
            All events
          </Button>
        </div>
        <div className="mt-8">
          <EventsCalendar calendar={calendar} upcoming={upcoming} />
        </div>
      </PageContainer>
    </section>
  );
}
