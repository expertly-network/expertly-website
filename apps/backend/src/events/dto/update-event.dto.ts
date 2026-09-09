import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import type { EventFormat, EventStatus } from '@shared/event';

const EVENT_FORMATS: EventFormat[] = ['in_person', 'virtual', 'hybrid'];
const EVENT_STATUSES: EventStatus[] = ['draft', 'published'];

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  // `@IsOptional()` treats both `undefined` (omitted) and `null` as "skip validation" — so
  // `null` passes through to EventsService.update(), which only leaves a column unchanged when
  // the key is absent entirely (`dto.field !== undefined`). This is what lets the admin form
  // clear a once-set optional field instead of the value being silently preserved.
  @IsOptional()
  @IsString()
  shortDescription?: string | null;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  eventType?: string | null;

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  eventFormat?: EventFormat | null;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  venueName?: string | null;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsUrl()
  registrationUrl?: string | null;

  @IsOptional()
  @IsString()
  organiserName?: string | null;

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: EventStatus;
}
