import { Card, Badge, SwipeRow } from '@/components/ui';
import {
  formatEventMonth,
  formatEventDay,
  formatEventFormat,
  isOnlineEvent,
  normalizeEventTitle,
} from '@/lib/events/format';
import type { EventDto } from '@shared/event';

// A simpler card list in place of a full calendar widget: a swipeable row on phones (the next card
// peeks in from the edge), a two-column grid up to the calendar breakpoint.
export function UpcomingEvents({ events }: { events: EventDto[] }) {
  return (
    <SwipeRow label="Upcoming events" itemWidth="92%" className="sm:grid-cols-2 sm:gap-4">
      {events.slice(0, 4).map((e) => (
        <Card key={e.id} padding="md" className="flex h-full min-w-0 snap-start gap-4 max-sm:!p-6">
          <div className="flex-none text-center">
            <div className="font-mono text-[11px] text-accent">{formatEventMonth(e.startDate)}</div>
            <div className="text-xl font-semibold text-ink">{formatEventDay(e.startDate)}</div>
          </div>
          <div className="min-w-0 border-l border-line pl-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {e.eventType && <Badge variant="neutral">{e.eventType}</Badge>}
              {e.eventFormat && (
                <span className="text-[11px] font-medium text-ok">{formatEventFormat(e.eventFormat)}</span>
              )}
            </div>
            <h4 className="mt-2 text-base font-medium leading-snug text-ink sm:mt-1.5 sm:text-sm">
              {normalizeEventTitle(e.title)}
            </h4>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-3 sm:mt-1 sm:text-xs">{e.description}</p>
            {isOnlineEvent(e) ? (
              <div className="mt-3 text-xs text-ink-3 sm:mt-2 sm:text-[11px]">Online</div>
            ) : (
              (e.city || e.country) && (
                <div className="mt-3 text-xs text-ink-3 sm:mt-2 sm:text-[11px]">
                  {[e.city, e.country].filter(Boolean).join(', ')}
                </div>
              )
            )}
          </div>
        </Card>
      ))}
    </SwipeRow>
  );
}
