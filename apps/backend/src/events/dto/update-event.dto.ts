import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  MaxLength,
} from 'class-validator';
import type { EventFormat, EventStatus } from '@shared/event';
import {
  EVENT_DESCRIPTION_MAX,
  EVENT_LABEL_MAX,
  EVENT_SHORT_DESCRIPTION_MAX,
  EVENT_TITLE_MAX,
  EVENT_URL_MAX,
  EVENT_URL_OPTIONS,
} from './create-event.dto';

const EVENT_FORMATS: EventFormat[] = ['in_person', 'virtual', 'hybrid'];
const EVENT_STATUSES: EventStatus[] = ['draft', 'published'];

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(EVENT_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(EVENT_DESCRIPTION_MAX)
  description?: string;

  // null clears the field; omitting it leaves it unchanged.
  @IsOptional()
  @IsString()
  @MaxLength(EVENT_SHORT_DESCRIPTION_MAX)
  shortDescription?: string | null;

  @IsOptional()
  @IsUrl(EVENT_URL_OPTIONS)
  @MaxLength(EVENT_URL_MAX)
  coverImageUrl?: string | null;

  @IsOptional()
  @IsDateString()
  @IsNotEmpty()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsTimeZone()
  @MaxLength(64)
  timezone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventType?: string | null;

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  eventFormat?: EventFormat | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(EVENT_LABEL_MAX)
  venueName?: string | null;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsUrl(EVENT_URL_OPTIONS)
  @MaxLength(EVENT_URL_MAX)
  registrationUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(EVENT_LABEL_MAX)
  organiserName?: string | null;

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: EventStatus;
}
