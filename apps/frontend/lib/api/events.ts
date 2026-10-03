import { apiFetch } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';
import { getApiBaseUrlClient } from '@/lib/api/base-url.client';
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

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function importEventsCsv(file: File): Promise<ImportEventsResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${getApiBaseUrlClient()}/v1/admin/events/import`, {
    method: 'POST',
    headers: await authHeader(),
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const rowErrors = Array.isArray(body?.message)
      ? body.message
      : [body?.message ?? `Request failed with status ${res.status}`];
    throw new ImportEventsError(rowErrors, res.status);
  }

  return res.json();
}

// Downloads straight to the browser rather than returning a URL — the export endpoint requires
// the same Bearer auth as every other admin route, so a plain `<a href>` to it won't work.
export async function downloadEventsCsv(): Promise<void> {
  const res = await fetch(`${getApiBaseUrlClient()}/v1/admin/events/export`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`Failed to export events (status ${res.status}).`);

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
