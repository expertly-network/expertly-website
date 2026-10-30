import type { ReactNode } from 'react';
import { Badge, Button } from '@/components/ui';
import type { EventDto } from '@shared/event';
import { externalHref } from '@/lib/members/format';
import { formatDayRange } from '@/lib/dates';
import { formatEventFormat, isOnlineEvent } from '@/lib/events/format';

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
  const online = isOnlineEvent(event);
  const location = online ? '' : [event.city, event.country].filter(Boolean).join(', ');

  const registrationHref = externalHref(event.registrationUrl);
  const registerAction = registrationHref ? (
    <Button href={registrationHref} variant="secondary" size="sm" className="self-start">
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
    // id + target: styles let the homepage calendar deep-link (/events#event-<id>) to this row.
    <div
      id={`event-${event.id}`}
      className={`scroll-mt-24 rounded-xl target:ring-2 target:ring-accent target:ring-offset-4 ${
        isMonthFirst
          ? 'grid grid-cols-[140px_1fr_180px_auto] items-center gap-x-9 rounded-xl bg-[color-mix(in_oklab,var(--accent)_6%,var(--bg-card))] px-5 py-7 -mx-5 my-2 max-[900px]:grid-cols-1 max-[900px]:gap-y-3 max-[900px]:px-4 max-[900px]:-mx-4'
          : 'grid grid-cols-[140px_1fr_180px_auto] items-center gap-x-9 border-b border-line py-7 max-[900px]:grid-cols-1 max-[900px]:gap-y-3'
      }`}
    >
      <div>
        <span className="mb-[5px] block font-mono text-[10px] text-ink-4">Date</span>
        <span className="text-[17px] font-medium leading-[1.2] tracking-[-0.02em] text-ink">
          {formatDayRange(event.startDate, event.endDate)}
        </span>
      </div>

      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {event.eventType && <Badge variant={isMonthFirst ? 'surface' : 'neutral'}>{event.eventType}</Badge>}
          {event.eventFormat && (
            <Badge variant={isMonthFirst ? 'surface' : event.eventFormat === 'in_person' ? 'neutral' : 'brand'}>
              {formatEventFormat(event.eventFormat)}
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

      {online ? (
        <div>
          <span className="mb-[5px] block font-mono text-[10px] text-ink-4">Location</span>
          <div className="text-[13px] font-medium text-ink-2">Online</div>
        </div>
      ) : location ? (
        <div>
          <span className="mb-[5px] block font-mono text-[10px] text-ink-4">Location</span>
          <div className="text-[13px] font-medium text-ink-2">{event.city}</div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-4">{event.country}</div>
        </div>
      ) : (
        // Keeps the four-column grid aligned when an event has no location at all.
        <div aria-hidden="true" className="max-[900px]:hidden" />
      )}

      {adminActions ?? registerAction}
    </div>
  );
}
