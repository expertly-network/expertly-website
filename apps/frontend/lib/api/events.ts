import { apiFetch } from '@/lib/api/client';
import type { CreateEventRequest, EventDto, UpdateEventRequest } from '@shared/event';

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
