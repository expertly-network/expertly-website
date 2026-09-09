'use client';

import { useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { EventsList } from '@/components/events/EventsList';
import { deleteEvent } from '@/lib/api/events';
import { ApiError } from '@/lib/api/client';
import type { EventDto, EventStatus } from '@shared/event';

const STATUS_BADGE_VARIANT: Record<EventStatus, 'neutral' | 'emphasis'> = {
  draft: 'neutral',
  published: 'emphasis',
};

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

// Inline expand-to-confirm delete, same UX as AdminApplicationsTable's reject flow — a plain
// confirm()/alert() would be inconsistent with how every other destructive admin action in this
// app already works.
function AdminEventActions({ event, onDeleted }: { event: EventDto; onDeleted: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setError(null);
    setBusy(true);
    try {
      await deleteEvent(event.id);
      onDeleted(event.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete this event.');
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 self-start">
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={confirmDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Confirm delete'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 self-start">
      <div className="flex gap-2">
        <Button href={`/admin/events/${event.id}/edit`} size="sm" variant="secondary">
          Edit
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// Thin state wrapper around the shared EventsList (components/events/EventsList.tsx) — owns the
// locally-mutable events array (so a delete removes its row immediately without a refetch) and
// the admin-only per-row badge/actions. The filters (date/country/format) and month-grouping
// underneath are the exact same EventsList the public /events page uses, not a forked copy —
// defaultDatePreset="all" is the only behavioral difference, since admin needs to see everything
// (including past events and drafts) by default rather than just what's upcoming.
export function AdminEventsList({ initialEvents }: { initialEvents: EventDto[] }) {
  const [events, setEvents] = useState(initialEvents);

  function handleDeleted(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <EventsList
      events={events}
      defaultDatePreset="all"
      emptyMessage="No events yet — create one to get started."
      getAdminBadge={(event) => (
        <Badge variant={STATUS_BADGE_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
      )}
      getAdminActions={(event) => <AdminEventActions event={event} onDeleted={handleDeleted} />}
    />
  );
}
