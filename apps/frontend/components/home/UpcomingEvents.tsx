import { Card, Badge } from '@/components/ui';
import { formatEventMonth, formatEventDay, formatEventFormat } from '@/lib/events/format';
import type { EventDto } from '@shared/event';

// A simpler card list in place of a full calendar widget.
export function UpcomingEvents({ events }: { events: EventDto[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {events.slice(0, 4).map((e) => (
        <Card key={e.id} padding="md" className="flex h-full gap-4">
          <div className="flex-none text-center">
            <div className="font-mono text-[11px] tracking-[0.1em] text-accent">
              {formatEventMonth(e.startDate)}
            </div>
            <div className="text-xl font-semibold text-ink">{formatEventDay(e.startDate)}</div>
          </div>
          <div className="min-w-0 border-l border-line pl-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {e.eventType && <Badge variant="neutral">{e.eventType}</Badge>}
              {e.eventFormat && (
                <span className="text-[11px] font-medium text-ok">
                  {formatEventFormat(e.eventFormat)}
                </span>
              )}
            </div>
            <h4 className="mt-1.5 text-sm font-medium text-ink">{e.title}</h4>
            <p className="mt-1 line-clamp-2 text-xs text-ink-3">{e.description}</p>
            {(e.city || e.country) && (
              <div className="mt-2 text-[11px] text-ink-3">
                {[e.city, e.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
