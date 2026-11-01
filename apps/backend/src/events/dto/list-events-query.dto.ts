import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { EVENT_FORMATS, EVENTS_PAGE_SIZE_MAX, type EventFormat } from '@shared/event';

// A repeated query param (?country=a&country=b) arrives as an array, a single one as a string.
const toArray = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

// GET /v1/events. `upcoming` (default true) is the dashboard's "not yet ended" list. With
// `upcoming=false` the list is filtered and paged on the server — the calendar is far too large
// (thousands of events) to ship whole: `from`/`to` (ISO dates, inclusive) keep events overlapping
// that span, `startFrom` keeps only events starting on/after a day, `country`/`format`/`type` narrow it, `page`/`pageSize` page it (total in X-Total-Count).
export class ListEventsQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  upcoming?: 'true' | 'false';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;

  // Only events starting on or after this day (an already-running event is excluded; `from` keeps it).
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startFrom?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  country?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(EVENT_FORMATS.length)
  @IsIn(EVENT_FORMATS, { each: true })
  format?: EventFormat[];

  /** Topic categories (taxonomy level 2); matches events tagged with any of them. */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  categoryId?: string[];

  /** Service lines (taxonomy level 1): events tagged with any category in these lines. */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  serviceLineId?: string[];

  /** Free-text keyword search (title, description, type, organiser, city, country). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  // Event type labels as stored (Seminar, Webinar, Conference, …), matched exactly.
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  type?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(EVENTS_PAGE_SIZE_MAX)
  pageSize?: number;
}

// GET /v1/events/days — which days (UTC dates) have a published event, for the date picker's dots.
export class EventDaysQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to!: string;
}
