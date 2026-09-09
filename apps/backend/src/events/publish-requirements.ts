import { BadRequestException } from '@nestjs/common';

// Fields the product requires before an event can go out as 'published' — a draft can still be
// saved with only title/description/startDate (CreateEventDto's own unconditional requireds).
// class-validator can't express "required only when status=published" as a DTO decorator (it has
// no cross-field concept), so this lives here and is applied in EventsService against whichever
// fields the event will actually end up with, not just what's in a single PATCH body.
const PUBLISH_REQUIRED_FIELDS: { key: string; label: string }[] = [
  { key: 'title', label: 'Event title' },
  { key: 'organiserName', label: 'Organizer' },
  { key: 'description', label: 'Description' },
  { key: 'startDate', label: 'Start date' },
  { key: 'endDate', label: 'End date' },
  { key: 'eventFormat', label: 'Format' },
  { key: 'eventType', label: 'Category' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'registrationUrl', label: 'Registration URL' },
];

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// Throws a 400 with one message per missing field — same array-of-strings shape
// class-validator's own errors already use, so ApiError/apiFetch's existing
// Array.isArray(message) handling on the frontend needs no changes to display it.
export function assertPublishReady(fields: Record<string, unknown>): void {
  const missing = PUBLISH_REQUIRED_FIELDS.filter(({ key }) => isBlank(fields[key]));
  if (missing.length > 0) {
    throw new BadRequestException(missing.map(({ label }) => `${label} is required to publish an event.`));
  }
}
