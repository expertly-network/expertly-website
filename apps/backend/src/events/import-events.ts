import { isURL } from 'class-validator';
import type { EventFormat, EventStatus } from '@shared/event';
import { missingPublishFields } from './publish-requirements';
import type { ParsedEventCsvRow } from './events-csv';
import type { EventInsert } from './events.repository';

const EVENT_FORMATS: EventFormat[] = ['in_person', 'virtual', 'hybrid'];
const EVENT_STATUSES: EventStatus[] = ['draft', 'published'];

export interface ValidatedEventRow {
  rowNumber: number;
  // null means this row creates a new event; non-null means it updates the event with that id.
  id: string | null;
  title: string;
  fields: {
    description: string;
    shortDescription: string | null;
    coverImageUrl: string | null;
    startDate: string;
    endDate: string | null;
    timezone: string | null;
    eventType: string | null;
    eventFormat: EventFormat | null;
    country: string | null;
    city: string | null;
    venueName: string | null;
    isFree: boolean;
    registrationUrl: string | null;
    organiserName: string | null;
    status: EventStatus;
  };
}

function cell(cells: Record<string, string>, key: string): string {
  return (cells[key] ?? '').trim();
}

function nullableCell(cells: Record<string, string>, key: string): string | null {
  const value = cell(cells, key);
  return value === '' ? null : value;
}

// Validates one CSV row in isolation (no DB access, each row treated as a full desired-state
// replace rather than a partial patch — matching how a spreadsheet row is naturally edited).
// Cross-row checks (duplicate/unknown ids) are the caller's job, since only it sees every row.
export function validateEventRow(row: ParsedEventCsvRow): { row: ValidatedEventRow } | { errors: string[] } {
  const errors: string[] = [];
  const prefix = `Row ${row.rowNumber}:`;

  const id = nullableCell(row.cells, 'id');
  const title = cell(row.cells, 'title');
  const description = cell(row.cells, 'description');
  const startDate = cell(row.cells, 'startDate');

  if (!title) errors.push(`${prefix} Title is required.`);
  if (!description) errors.push(`${prefix} Description is required.`);
  if (!startDate) errors.push(`${prefix} Start date is required.`);

  const coverImageUrl = nullableCell(row.cells, 'coverImageUrl');
  if (coverImageUrl && !isURL(coverImageUrl)) errors.push(`${prefix} Cover image URL is not a valid URL.`);

  const registrationUrl = nullableCell(row.cells, 'registrationUrl');
  if (registrationUrl && !isURL(registrationUrl)) errors.push(`${prefix} Registration URL is not a valid URL.`);

  const eventFormatRaw = nullableCell(row.cells, 'eventFormat');
  if (eventFormatRaw && !EVENT_FORMATS.includes(eventFormatRaw as EventFormat)) {
    errors.push(`${prefix} Format must be one of ${EVENT_FORMATS.join(', ')}.`);
  }

  const statusRaw = cell(row.cells, 'status');
  if (statusRaw && !EVENT_STATUSES.includes(statusRaw as EventStatus)) {
    errors.push(`${prefix} Status must be one of ${EVENT_STATUSES.join(', ')}.`);
  }
  const status: EventStatus = (statusRaw as EventStatus) || 'draft';

  const isFreeRaw = cell(row.cells, 'isFree').toLowerCase();
  let isFree = false;
  if (isFreeRaw === 'true') isFree = true;
  else if (isFreeRaw !== '' && isFreeRaw !== 'false') errors.push(`${prefix} isFree must be "true" or "false".`);

  const fields: ValidatedEventRow['fields'] = {
    description,
    shortDescription: nullableCell(row.cells, 'shortDescription'),
    coverImageUrl,
    startDate,
    endDate: nullableCell(row.cells, 'endDate'),
    timezone: nullableCell(row.cells, 'timezone'),
    eventType: nullableCell(row.cells, 'eventType'),
    eventFormat: eventFormatRaw as EventFormat | null,
    country: nullableCell(row.cells, 'country'),
    city: nullableCell(row.cells, 'city'),
    venueName: nullableCell(row.cells, 'venueName'),
    isFree,
    registrationUrl,
    organiserName: nullableCell(row.cells, 'organiserName'),
    status,
  };

  if (status === 'published') {
    errors.push(...missingPublishFields({ title, ...fields }).map((message) => `${prefix} ${message}`));
  }

  if (errors.length > 0) return { errors };
  return { row: { rowNumber: row.rowNumber, id, title, fields } };
}

// Maps a validated row onto `events` table columns, excluding `slug` — a create assigns one
// server-side (see EventsService.importFromCsv()), an update never touches the existing one.
export function toEventColumns(row: ValidatedEventRow): Omit<EventInsert, 'slug'> {
  return {
    title: row.title,
    description: row.fields.description,
    short_description: row.fields.shortDescription,
    cover_image_url: row.fields.coverImageUrl,
    start_date: row.fields.startDate,
    end_date: row.fields.endDate,
    timezone: row.fields.timezone,
    event_type: row.fields.eventType,
    event_format: row.fields.eventFormat,
    country: row.fields.country,
    city: row.fields.city,
    venue_name: row.fields.venueName,
    is_free: row.fields.isFree,
    registration_url: row.fields.registrationUrl,
    organiser_name: row.fields.organiserName,
    status: row.fields.status,
  };
}
