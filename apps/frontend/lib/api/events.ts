import { ApiError, apiFetch, apiFetchPage, apiFetchResponse } from '@/lib/api/client';
import type {
  CreateEventRequest,
  EventDaysResponse,
  EventDto,
  ImportEventsResponse,
  ListEventsQuery,
  UpdateEventRequest,
  EventCalendarResponse,
  EventOrganiserDto,
} from '@shared/event';
import { buildEventsQueryString, EVENTS_TOTAL_COUNT_HEADER } from '@/lib/api/events-query';

// One server-filtered page of published events plus the total match count (browser side).
export function listEventsPage(query: ListEventsQuery): Promise<{ items: EventDto[]; total: number }> {
  return apiFetchPage<EventDto>(
    `/events${buildEventsQueryString({ ...query, upcoming: 'false' })}`,
    EVENTS_TOTAL_COUNT_HEADER
  );
}

// Days (UTC dates, YYYY-MM-DD) with a published event between `from` and `to`, for the picker's dots.
// The home calendar's month: per-day counts plus the first two events of each day.
export function getEventCalendar(from: string, to: string): Promise<EventCalendarResponse> {
  return apiFetch<EventCalendarResponse>(
    `/events/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
}

// Organisers with published events, most events first — the organiser filter's options.
export function getEventOrganisers(): Promise<EventOrganiserDto[]> {
  return apiFetch<EventOrganiserDto[]>('/events/organisers');
}

export function getEventDays(from: string, to: string): Promise<EventDaysResponse> {
  return apiFetch<EventDaysResponse>(`/events/days?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export function createEvent(body: CreateEventRequest): Promise<EventDto> {
  return apiFetch<EventDto>('/admin/events', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateEvent(id: string, body: UpdateEventRequest): Promise<EventDto> {
  return apiFetch<EventDto>(`/admin/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteEvent(id: string): Promise<void> {
  return apiFetch<void>(`/admin/events/${id}`, {
    method: 'DELETE',
  });
}

// Carries the full per-row message list (unlike ApiError, which joins them into one string) —
// the import modal renders these as a list rather than a run-on paragraph.
export class ImportEventsError extends Error {
  constructor(
    public readonly rowErrors: string[],
    public readonly statusCode: number
  ) {
    super(rowErrors.join(' '));
    this.name = 'ImportEventsError';
  }
}

export async function importEventsCsv(file: File): Promise<ImportEventsResponse> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    return await apiFetch<ImportEventsResponse>('/admin/events/import', { method: 'POST', body: formData });
  } catch (err) {
    // The import's 400 lists one message per bad row — keep them separate for the results table.
    if (err instanceof ApiError) throw new ImportEventsError(err.messages, err.statusCode);
    throw err;
  }
}

// Downloads straight to the browser rather than returning a URL — the export endpoint requires
// the same Bearer auth as every other admin route, so a plain `<a href>` to it won't work.
export async function downloadEventsCsv(): Promise<void> {
  const res = await apiFetchResponse('/admin/events/export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'events.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
