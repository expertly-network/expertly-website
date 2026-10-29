import { ApiError, apiFetch, apiFetchResponse } from '@/lib/api/client';
import type { CreateEventRequest, EventDto, ImportEventsResponse, UpdateEventRequest } from '@shared/event';

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
