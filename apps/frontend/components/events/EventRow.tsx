import type { ReactNode } from 'react';
import { Badge, Button } from '@/components/ui';
import type { EventDto } from '@shared/event';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

const FORMAT_LABEL: Record<NonNullable<EventDto['eventFormat']>, string> = {
  in_person: 'In Person',
  hybrid: 'Hybrid',
  virtual: 'Virtual',
};

function formatDateRange(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  if (!endDate) return DATE_FORMAT.format(start);
  const end = new Date(endDate);
  if (start.toDateString() === end.toDateString()) return DATE_FORMAT.format(start);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(start)} ${start.getDate()}–${end.getDate()}`
    : `${DATE_FORMAT.format(start)} – ${DATE_FORMAT.format(end)}`;
}

// adminBadge/adminActions let the admin list show a status badge and swap in edit/delete actions.
export function EventRow({
  event,
  isMonthFirst = false,
  adminBadge,
  adminActions,
}: {
  event: EventDto;
  isMonthFirst?: boolean;
  adminBadge?: ReactNode;
  adminActions?: ReactNode;
}) {
  const location = [event.city, event.country].filter(Boolean).join(', ');

  const registerAction = event.registrationUrl ? (
    <Button href={event.registrationUrl} variant="secondary" size="sm" className="self-start">
      Register →
    </Button>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      disabled
      aria-disabled="true"
      title="Coming soon — registration isn't live yet"
      className="self-start"
    >
      Register →
    </Button>
  );

  return (
    <div
      className={
        isMonthFirst
          ? 'grid grid-cols-[140px_1fr_180px_auto] items-center gap-x-9 rounded-xl bg-[color-mix(in_oklab,var(--accent)_6%,var(--bg-card))] px-5 py-7 max-[900px]:grid-cols-1 max-[900px]:gap-y-3 max-[900px]:px-4'
          : 'grid grid-cols-[140px_1fr_180px_auto] items-center gap-x-9 border-b border-line py-7 max-[900px]:grid-cols-1 max-[900px]:gap-y-3'
      }
    >
      <div>
        <span className="mb-1 block font-mono text-[10px] tracking-[0.12em] text-ink-4">Date</span>
        <span className="text-[17px] font-medium leading-[1.2] tracking-[-0.02em] text-ink">
          {formatDateRange(event.startDate, event.endDate)}
        </span>
      </div>

      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {event.eventType && <Badge variant="neutral">{event.eventType}</Badge>}
          {event.eventFormat && (
            <Badge variant={event.eventFormat === 'in_person' ? 'neutral' : 'brand'}>
              {FORMAT_LABEL[event.eventFormat]}
            </Badge>
          )}
          {adminBadge}
        </div>
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-[1.25] tracking-[-0.018em] text-ink">
          {event.title}
        </h3>
        {event.description && (
          <p className="mt-1 line-clamp-1 text-[13px] leading-[1.5] text-ink-3">{event.description}</p>
        )}
      </div>

      {location && (
        <div>
          <span className="mb-1 block font-mono text-[10px] tracking-[0.12em] text-ink-4">Location</span>
          <div className="text-[13px] font-medium text-ink-2">{event.city}</div>
          <div className="mt-0.5 font-mono text-[11px] tracking-[0.04em] text-ink-4">{event.country}</div>
        </div>
      )}

      {adminActions ?? registerAction}
    </div>
  );
}
