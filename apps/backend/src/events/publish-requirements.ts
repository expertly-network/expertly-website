import { BadRequestException } from '@nestjs/common';

// Fields required before an event can be published.
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

// Returns one message per missing required field (empty array if all present) — the non-throwing
// half of assertPublishReady, used where a caller collects errors across many rows before
// deciding whether to throw at all (see EventsService.importFromCsv()).
export function missingPublishFields(fields: Record<string, unknown>): string[] {
  return PUBLISH_REQUIRED_FIELDS.filter(({ key }) => isBlank(fields[key])).map(
    ({ label }) => `${label} is required to publish an event.`
  );
}

// Throws a 400 listing every missing required field.
export function assertPublishReady(fields: Record<string, unknown>): void {
  const missing = missingPublishFields(fields);
  if (missing.length > 0) throw new BadRequestException(missing);
}
