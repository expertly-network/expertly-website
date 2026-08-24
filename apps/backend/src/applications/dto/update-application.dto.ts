import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ApplicationRegion, BillingPeriod } from '@shared/membership-application';
import { WorkExperienceDto } from './work-experience.dto';
import { EducationDto } from './education.dto';
import { ServicePreferenceDto } from './service-preference.dto';

const REGIONS: ApplicationRegion[] = [
  'asia_pacific',
  'europe',
  'latin_america',
  'middle_east',
  'north_america',
  'south_asia',
  'africa',
];
const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'annual'];

// Every field optional — a draft can be arbitrarily incomplete, and a single save-on-advance call
// only carries the fields for the step just completed. Completeness for `status: 'submitted'` is
// checked in ApplicationsService.assertComplete against the *merged* row, not here — same
// "cross-field rules live in the service" convention the old CreateApplicationDto followed for
// rateMaxCents > rateMinCents.
export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(REGIONS)
  region?: ApplicationRegion;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => WorkExperienceDto)
  workExperiences?: WorkExperienceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations?: EducationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ServicePreferenceDto)
  servicePreferences?: ServicePreferenceDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  rateMinCents?: number;

  // rateMaxCents > rateMinCents is a cross-field rule, checked in ApplicationsService against the
  // merged row (both fields might arrive across different calls).
  @IsOptional()
  @IsInt()
  rateMaxCents?: number;

  @IsOptional()
  @IsIn(BILLING_PERIODS)
  billingPeriod?: BillingPeriod;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsBoolean()
  linkedinImportConsent?: boolean;

  @IsOptional()
  @IsString()
  termsVersionAgreed?: string;

  @IsOptional()
  @IsString()
  privacyVersionAgreed?: string;

  @IsOptional()
  @IsBoolean()
  backgroundCheckConsent?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  currentStep?: number;

  @IsOptional()
  @IsIn(['draft', 'submitted'])
  status?: 'draft' | 'submitted';
}
