import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import type { FirmSize } from '@shared/membership-application';
import { FREE_TEXT_MAX, LABEL_MAX, PLACE_MAX, URL_MAX, YEAR_MAX, YEAR_MIN } from './field-limits';

// LinkedIn's company-size bands. '200_plus' is the pre-2026-11-14 top band: no longer offered by
// the wizard, still accepted so an application saved with it keeps validating on later saves.
const FIRM_SIZES: FirmSize[] = [
  'solo',
  '2_10',
  '11_50',
  '51_200',
  '201_500',
  '501_1000',
  '1001_5000',
  '5001_10000',
  '10001_plus',
  '200_plus',
];

// title/company may be blank in a draft (a half-filled card saved by the wizard's per-step save);
// both are required at submit — see application-completeness.ts.
export class WorkExperienceDto {
  @IsString()
  @MaxLength(LABEL_MAX)
  title!: string;

  @IsString()
  @MaxLength(LABEL_MAX)
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PLACE_MAX)
  city?: string;

  @IsOptional()
  @IsIn(FIRM_SIZES)
  firmSize?: FirmSize;

  @IsOptional()
  @IsUrl()
  @MaxLength(URL_MAX)
  companyUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth?: number;

  @IsInt()
  @Min(YEAR_MIN)
  @Max(YEAR_MAX)
  startYear!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(YEAR_MIN)
  @Max(YEAR_MAX)
  endYear?: number;

  @IsBoolean()
  isCurrent!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  description?: string;
}
