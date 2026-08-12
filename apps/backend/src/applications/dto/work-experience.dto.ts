import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import type { FirmSize } from '@shared/membership-application';

const FIRM_SIZES: FirmSize[] = ['solo', '2_10', '11_50', '51_200', '200_plus'];

export class WorkExperienceDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  company!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsIn(FIRM_SIZES)
  firmSize?: FirmSize;

  @IsOptional()
  @IsUrl()
  companyUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth?: number;

  @IsInt()
  startYear!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth?: number;

  @IsOptional()
  @IsInt()
  endYear?: number;

  @IsBoolean()
  isCurrent!: boolean;
}
