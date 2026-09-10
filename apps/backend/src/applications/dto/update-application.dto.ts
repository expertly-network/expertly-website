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
const BILLING_PERIODS: BillingPeriod[] = ['annual'];

// Every field optional — a draft may be incomplete; completeness for `status: 'submitted'` is
// validated server-side.
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
