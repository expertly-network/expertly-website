import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import type { EventDto } from '@shared/event';

// Every column the export writes, in order. Import reads a subset of these (see
// IMPORT_COLUMNS below) — `slug`/`createdAt`/`updatedAt` are server-owned and, if present on
// re-upload of an unmodified export, are simply ignored rather than rejected.
export const EXPORT_COLUMNS = [
  'id',
  'title',
  'slug',
  'description',
  'shortDescription',
  'coverImageUrl',
  'startDate',
  'endDate',
  'timezone',
  'eventType',
  'eventFormat',
  'country',
  'city',
  'venueName',
  'isFree',
  'registrationUrl',
  'organiserName',
  'status',
  'createdAt',
  'updatedAt',
] as const;

// The columns importFromCsv() actually requires to be present as headers — the unconditional
// requireds on a single-event create, same as CreateEventDto.
export const REQUIRED_IMPORT_COLUMNS = ['title', 'description', 'startDate'] as const;

export function eventsToCsv(events: EventDto[]): string {
  const rows = events.map((event) => EXPORT_COLUMNS.map((col) => stringifyCell((event as unknown as Record<string, unknown>)[col])));
  return stringify([EXPORT_COLUMNS as unknown as string[], ...rows]);
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export interface ParsedEventCsvRow {
  // 1-based, matching what a spreadsheet shows (header is row 1, first data row is 2).
  rowNumber: number;
  // Raw string cells keyed by header name, exactly as parsed — callers do the field-by-field
  // validation/coercion since the rules differ per column (see EventsService.importFromCsv()).
  cells: Record<string, string>;
}

export interface ParsedEventCsv {
  rows: ParsedEventCsvRow[];
  // Non-empty only when a required header is missing entirely — callers should surface this and
  // not attempt row-level validation at all in that case.
  headerErrors: string[];
}

export function parseEventsCsv(buffer: Buffer): ParsedEventCsv {
  let records: Record<string, string>[];
  try {
    records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch {
    throw new BadRequestException('Could not parse this file as CSV.');
  }

  // With zero data rows, csv-parse's `columns: true` can't tell us what the header row
  // contained — leave header validation to the caller's own "no rows" check instead of guessing.
  const headerErrors =
    records.length === 0
      ? []
      : REQUIRED_IMPORT_COLUMNS.filter((col) => !Object.keys(records[0]).includes(col)).map(
          (col) => `CSV is missing required column "${col}".`
        );

  return {
    rows: records.map((cells, index) => ({ rowNumber: index + 2, cells })),
    headerErrors,
  };
}
