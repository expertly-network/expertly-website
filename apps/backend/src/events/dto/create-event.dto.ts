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

const EVENT_FORMATS: EventFormat[] = ['in_person', 'virtual', 'hybrid'];
const EVENT_STATUSES: EventStatus[] = ['draft', 'published'];

// Field caps (the admin form has no maxLength; these are generous ceilings, not UX limits).
export const EVENT_TITLE_MAX = 200;
export const EVENT_DESCRIPTION_MAX = 20000;
export const EVENT_SHORT_DESCRIPTION_MAX = 500;
export const EVENT_LABEL_MAX = 200;
export const EVENT_URL_MAX = 2048;
// http(s) only — these render as <a href>/<img src>. A scheme-less "www.x.com" is still accepted.
export const EVENT_URL_OPTIONS = { protocols: ['http', 'https'] };

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(EVENT_TITLE_MAX)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(EVENT_DESCRIPTION_MAX)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(EVENT_SHORT_DESCRIPTION_MAX)
  shortDescription?: string | null;

  @IsOptional()
  @IsUrl(EVENT_URL_OPTIONS)
  @MaxLength(EVENT_URL_MAX)
  coverImageUrl?: string | null;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

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

  // Defaults to 'draft' if omitted.
  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: EventStatus;
}
