import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const EVENT_FORMATS = ['in_person', 'virtual', 'hybrid'] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];
export type EventStatus = 'draft' | 'published';

// Matches supabase/migrations/0004_tables.sql's `events` table. No separate list-item type
// (unlike ArticleListItemDto/ArticleDto) — `description` isn't a heavy field the way an
// article's `body` is, so there's nothing to omit for a browse/list view.
export class EventDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ nullable: true, type: String }) shortDescription!: string | null;
  @ApiProperty({ nullable: true, type: String }) coverImageUrl!: string | null;
  @ApiProperty() startDate!: string;
  @ApiProperty({ nullable: true, type: String }) endDate!: string | null;
  @ApiProperty({ nullable: true, type: String }) timezone!: string | null;
  @ApiProperty({ nullable: true, type: String }) eventType!: string | null;
  @ApiProperty({ nullable: true, enum: ['in_person', 'virtual', 'hybrid'] }) eventFormat!: EventFormat | null;
  @ApiProperty({ nullable: true, type: String }) country!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ nullable: true, type: String }) venueName!: string | null;
  @ApiProperty() isFree!: boolean;
  @ApiProperty({ nullable: true, type: String }) registrationUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) organiserName!: string | null;
  /** Topic categories (taxonomy level 2); names come from GET /v1/categories. */
  @ApiProperty({ type: String, isArray: true }) categoryIds!: string[];
  @ApiProperty({ enum: ['draft', 'published'] }) status!: EventStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class CreateEventRequest {
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  // Nullable (not just optional) on every field below — PATCH needs `null` to distinguish
  // "clear this field" from "leave it as-is" (omitted). EventsService.update() only touches a
  // column when the key is present at all (`dto.field !== undefined`), so an admin clearing an
  // optional field in the edit form must send an explicit `null`, not just an empty string that
  // gets stripped to `undefined`.
  @ApiPropertyOptional({ nullable: true, type: String }) shortDescription?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) coverImageUrl?: string | null;
  @ApiProperty() startDate!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) endDate?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) timezone?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) eventType?: string | null;
  @ApiPropertyOptional({ nullable: true, enum: ['in_person', 'virtual', 'hybrid'] })
  eventFormat?: EventFormat | null;
  @ApiPropertyOptional({ nullable: true, type: String }) country?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) city?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) venueName?: string | null;
  @ApiPropertyOptional() isFree?: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) registrationUrl?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) organiserName?: string | null;
  /** At most 5. Omitted on create → inferred from the title/description. */
  @ApiPropertyOptional({ type: String, isArray: true }) categoryIds?: string[];
  /** Omit for `'draft'` — matches the `events.status` column's own default. The admin form
   * always sends an explicit draft-or-publish choice; this only matters as a safety net. */
  @ApiPropertyOptional({ enum: ['draft', 'published'] }) status?: EventStatus;
}

// All fields optional; only provided fields change.
export type UpdateEventRequest = Partial<CreateEventRequest>;

export type ImportEventsRowAction = 'created' | 'updated' | 'deleted';

// One per event the import actually changed. `row` is the 1-based CSV row (header is row 1, so
// the first data row is 2) — null for a `deleted` action, since a deletion is driven by an
// existing event's id being absent from the file entirely, not by any specific row in it.
export class ImportEventsRowResultDto {
  @ApiProperty({ nullable: true, type: Number }) row!: number | null;
  @ApiProperty({ enum: ['created', 'updated', 'deleted'] }) action!: ImportEventsRowAction;
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
}

// POST /v1/admin/events/import's success response. All-or-nothing: this shape is only ever
// returned when every row validated — see EventDto's ImportEventsRowResultDto docs in
// `docs/rest-api.md` for the 400 shape when a row fails.
export class ImportEventsResponse {
  @ApiProperty() createdCount!: number;
  @ApiProperty() updatedCount!: number;
  @ApiProperty() deletedCount!: number;
  @ApiProperty({ type: [ImportEventsRowResultDto] }) results!: ImportEventsRowResultDto[];
}

// GET /v1/events?upcoming=false — server-side filtered and paged (total matches in X-Total-Count).
export const EVENTS_PAGE_SIZE_DEFAULT = 50;
export const EVENTS_PAGE_SIZE_MAX = 1000;

export interface ListEventsQuery {
  upcoming?: 'true' | 'false';
  /** ISO date (YYYY-MM-DD): events still running on or after it. */
  from?: string;
  /** ISO date (YYYY-MM-DD), inclusive: events starting on or before it. */
  to?: string;
  /**
   * ISO date (YYYY-MM-DD): only events that start on or after it — unlike `from`, an event already
   * running is excluded. Lets a per-month list show each event once, in the month it starts.
   */
  startFrom?: string;
  country?: string[];
  format?: EventFormat[];
  /** Topic categories; any match. */
  categoryId?: string[];
  /** Service lines; events tagged with any category in them. */
  serviceLineId?: string[];
  /** Free-text keyword search over title, description, type, organiser, city and country. */
  q?: string;
  /** Event type labels, matched exactly (e.g. Seminar, Webinar). */
  type?: string[];
  page?: number;
  pageSize?: number;
}

// GET /v1/events/calendar?from=&to= — the home page's month grid. Per UTC day: how many published
// events run that day, and only the first few of them (lean fields, no description).
export interface CalendarEventDto {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  country: string | null;
  eventFormat: EventFormat | null;
}

export interface EventCalendarDay {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  /** Every published event running that day. */
  count: number;
  /** EVENT_CALENDAR_PER_DAY of them: events starting that day first (earliest first), then ongoing ones. */
  events: CalendarEventDto[];
}

export const EVENT_CALENDAR_PER_DAY = 2;
export const EVENT_CALENDAR_MAX_DAYS = 62;

export interface EventCalendarResponse {
  /** Only days with at least one event, ascending. */
  days: EventCalendarDay[];
}

// GET /v1/events/days?from=&to= — UTC dates (YYYY-MM-DD) on which a published event runs.
export interface EventDaysResponse {
  days: string[];
}
