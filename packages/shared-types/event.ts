import { ApiProperty } from '@nestjs/swagger';

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
