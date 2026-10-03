import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type EventFormat = 'in_person' | 'virtual' | 'hybrid';
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
