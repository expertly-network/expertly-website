'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Badge, Button } from '@/components/ui';
import type { EventDto } from '@shared/event';
import { externalHref } from '@/lib/members/format';
import { formatDayRange } from '@/lib/dates';
import {
  formatEventDay,
  formatEventFormat,
  formatEventMonth,
  isOnlineEvent,
  normalizeEventTitle,
} from '@/lib/events/format';

// adminBadge/adminActions let the admin list show a status badge and swap in edit/delete actions.
// Clicking anywhere on the row (outside its links/buttons) expands it to the full description and
// organiser details; the title stays a real button so keyboard users get the same toggle.
export function EventRow({
  event,
  topics = [],
  adminBadge,
  adminActions,
}: {
  event: EventDto;
  /** Topic category names, shown as tags in the badge row above the title. */
  topics?: string[];
  adminBadge?: ReactNode;
  adminActions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const online = isOnlineEvent(event);
  const title = normalizeEventTitle(event.title);
  const hasMore = !!(event.description || event.organiserName || event.venueName);

  // The homepage calendar deep-links to /events#event-<id>; open that row's details on arrival.
  useEffect(() => {
    if (window.location.hash === `#event-${event.id}`) setExpanded(true);
  }, [event.id]);

  const registrationHref = externalHref(event.registrationUrl);
  // Registration lives on the organiser's site — open it in a new tab so the user keeps their
  // place (scroll position, filters) on Expertly.
  const registerAction = registrationHref ? (
    <Button
      href={registrationHref}
      target="_blank"
      rel="noopener noreferrer"
      variant="secondary"
      size="sm"
      className="self-start"
    >
      Register ↗
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
      Register ↗
    </Button>
  );

  const renderDetails = (id: string) => (
    <div id={id} className="mt-3 space-y-3 rounded-lg bg-bg-alt p-4">
      {event.description && (
        <p className="whitespace-pre-line text-[14px] leading-[1.65] text-ink-2">{event.description}</p>
      )}
      {(event.organiserName || event.venueName) && (
        <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
          {event.organiserName && (
            <div>
              <dt className="font-mono text-[10px] text-ink-4">Organiser</dt>
              <dd className="font-medium text-ink-2">{event.organiserName}</dd>
            </div>
          )}
          {event.venueName && !online && (
            <div>
              <dt className="font-mono text-[10px] text-ink-4">Venue</dt>
              <dd className="font-medium text-ink-2">{event.venueName}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
  // Phone meta line: online events already say "Online" in the tag row above.
  const location = online ? null : (event.country ?? event.city);

  return (
    <div
      id={`event-${event.id}`}
      onClick={(e) => {
        // Links/buttons inside the row (Register, admin actions, the title itself) keep their own
        // behaviour; a drag-to-select of the text shouldn't toggle either.
        if (!hasMore || (e.target as HTMLElement).closest('a, button, input, select, textarea')) return;
        if (window.getSelection()?.toString()) return;
        setExpanded((v) => !v);
      }}
      className={`scroll-mt-32 border-b border-line py-4 target:ring-2 target:ring-accent target:ring-offset-4 sm:py-7 ${
        hasMore ? 'cursor-pointer' : ''
      }`}
    >
      {/* Phones: date block, type/format, title, "dates · location" and a compact Register link.
          Tapping the row expands the description and organiser, as on larger screens. */}
      <div className="grid grid-cols-[44px_1fr] gap-x-3.5 sm:hidden">
        <div className="pt-0.5 text-center">
          <div className="font-mono text-[11px] uppercase text-accent">
            {formatEventMonth(event.startDate).slice(0, 3)}
          </div>
          <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">
            {formatEventDay(event.startDate)}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-ink-3">
            {event.eventType && <span>{event.eventType}</span>}
            {(event.eventFormat === 'in_person' || event.eventFormat === 'hybrid') && (
              <span>· {formatEventFormat('in_person')}</span>
            )}
            {(event.eventFormat === 'virtual' || event.eventFormat === 'hybrid') && (
              <span className="text-accent">· {formatEventFormat('virtual')}</span>
            )}
            {event.isFree && <span>· Free</span>}
            {adminBadge}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            disabled={!hasMore}
            aria-expanded={expanded}
            aria-controls={`${detailsId}-phone`}
            className="mt-1 block w-full text-left disabled:cursor-default"
          >
            <h3 className="line-clamp-3 text-[15px] font-semibold leading-[1.3] tracking-[-0.012em] text-ink">
              {title}
            </h3>
          </button>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-xs text-ink-3">
              {formatDayRange(event.startDate, event.endDate)}
              {location && <> · {location}</>}
            </span>
            {!adminActions &&
              (registrationHref ? (
                <a
                  href={registrationHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="-my-2 inline-flex min-h-11 flex-none items-center text-[13px] font-semibold text-accent"
                >
                  Register ↗
                </a>
              ) : (
                <span className="flex-none text-[13px] text-ink-4" title="Registration isn't live yet">
                  Register soon
                </span>
              ))}
          </div>
          {adminActions && <div className="mt-2">{adminActions}</div>}
          {expanded && renderDetails(`${detailsId}-phone`)}
        </div>
      </div>

      <div className="hidden grid-cols-[140px_1fr_180px_auto] items-start gap-x-9 sm:grid max-[900px]:grid-cols-1 max-[900px]:gap-y-3">
        <div>
          <span className="mb-[5px] block font-mono text-[10px] text-ink-4">Date</span>
          <span className="text-[17px] font-medium leading-[1.2] tracking-[-0.02em] text-ink">
            {formatDayRange(event.startDate, event.endDate)}
          </span>
        </div>

        <div className="min-w-0">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {event.eventType && <Badge variant="neutral">{event.eventType}</Badge>}
            {/* A hybrid event is both In Person and Online. In Person is neutral, Online is brand green. */}
            {(event.eventFormat === 'in_person' || event.eventFormat === 'hybrid') && (
              <Badge variant="neutral">{formatEventFormat('in_person')}</Badge>
            )}
            {(event.eventFormat === 'virtual' || event.eventFormat === 'hybrid') && (
              <Badge variant="brand">{formatEventFormat('virtual')}</Badge>
            )}
            {event.isFree && <Badge variant="neutral">Free</Badge>}
            {topics.map((t) => (
              <Badge key={t} variant="surface">
                {t}
              </Badge>
            ))}
            {adminBadge}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            disabled={!hasMore}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className="group block w-full text-left disabled:cursor-default"
          >
            <h3 className="text-[17px] font-semibold leading-[1.3] tracking-[-0.018em] text-ink group-enabled:group-hover:text-accent">
              {title}
            </h3>
            {event.description && !expanded && (
              <p className="mt-1 line-clamp-2 text-[13px] leading-[1.55] text-ink-3">{event.description}</p>
            )}
          </button>
          {expanded && renderDetails(detailsId)}
        </div>

        {online ? (
          <div>
            <span className="mb-[5px] block font-mono text-[10px] text-ink-4">Location</span>
            <div className="text-[13px] font-medium text-ink-2">Online</div>
          </div>
        ) : event.country || event.city ? (
          // Country leads: most imported events have a country but no city/state.
          <div>
            <span className="mb-[5px] block font-mono text-[10px] text-ink-4">Location</span>
            <div className="text-[13px] font-medium text-ink-2">{event.country ?? event.city}</div>
            {event.country && event.city && <div className="mt-0.5 font-mono text-[11px] text-ink-4">{event.city}</div>}
          </div>
        ) : (
          // Keeps the four-column grid aligned when an event has no location at all.
          <div aria-hidden="true" className="max-[900px]:hidden" />
        )}

        {adminActions ?? registerAction}
      </div>
    </div>
  );
}
