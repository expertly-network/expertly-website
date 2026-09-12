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

  // null clears the field; omitting it leaves it unchanged.
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
