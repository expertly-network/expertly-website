import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
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

export class CreateApplicationDto {
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn(REGIONS)
  region!: ApplicationRegion;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsUrl()
  linkedinUrl!: string;

  @IsString()
  @MaxLength(500)
  bio!: string;

  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => WorkExperienceDto)
  workExperiences!: WorkExperienceDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations!: EducationDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ServicePreferenceDto)
  servicePreferences!: ServicePreferenceDto[];

  @IsInt()
  @Min(0)
  rateMinCents!: number;

  // rateMaxCents > rateMinCents is a cross-field rule — checked in
  // ApplicationsService, not here (class-validator doesn't do cross-field
  // checks cleanly without a bespoke decorator for one call site).
  @IsInt()
  rateMaxCents!: number;

  @IsIn(BILLING_PERIODS)
  billingPeriod!: BillingPeriod;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsBoolean()
  linkedinImportConsent!: boolean;

  @IsString()
  @IsNotEmpty()
  termsVersionAgreed!: string;

  @IsString()
  @IsNotEmpty()
  privacyVersionAgreed!: string;

  // Must be true to submit — Equals(true) rejects false/undefined alike.
  @IsBoolean()
  @Equals(true)
  backgroundCheckConsent!: boolean;
}
