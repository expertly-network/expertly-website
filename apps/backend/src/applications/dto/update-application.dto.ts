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
import { PeerReferenceDto } from './peer-reference.dto';

// Room for a full LinkedIn history (incl. several sub-roles at one firm). The LinkedIn import
// provider caps at these same numbers; the wizard mirrors them in BackgroundStep.
export const WORK_EXPERIENCES_MAX = 15;
export const EDUCATIONS_MAX = 5;
import { ServicePreferenceDto } from './service-preference.dto';
import { EMAIL_MAX, NAME_MAX, PHONE_MAX, PLACE_MAX, URL_MAX } from './field-limits';

const REGIONS: ApplicationRegion[] = [
  'asia_pacific',
  'europe',
  'latin_america',
  'middle_east',
  'north_america',
  'south_asia',
  'africa',
];
const BILLING_PERIODS: BillingPeriod[] = ['annual'];

// Every field optional — a draft may be incomplete; completeness for `status: 'submitted'` is
// validated server-side.
export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(EMAIL_MAX)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PHONE_MAX)
  phone?: string;

  @IsOptional()
  @IsIn(REGIONS)
  region?: ApplicationRegion;

  @IsOptional()
  @IsString()
  @MaxLength(PLACE_MAX)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PLACE_MAX)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PLACE_MAX)
  city?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(URL_MAX)
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(WORK_EXPERIENCES_MAX)
  @ValidateNested({ each: true })
  @Type(() => WorkExperienceDto)
  workExperiences?: WorkExperienceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(EDUCATIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations?: EducationDto[];

  // Exactly 2 required to submit.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PeerReferenceDto)
  peerReferences?: PeerReferenceDto[];

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

  // Must be greater than rateMinCents.
  @IsOptional()
  @IsInt()
  @Min(0)
  rateMaxCents?: number;

  @IsOptional()
  @IsIn(BILLING_PERIODS)
  billingPeriod?: BillingPeriod;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;

  @IsOptional()
  @IsBoolean()
  linkedinImportConsent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  termsVersionAgreed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
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
