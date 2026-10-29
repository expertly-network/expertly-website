import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsIn,
  IsUrl,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { PERK_CATEGORIES, type PerkCategory } from '@shared/resource';

export class UpdatePerkDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/\S/)
  name?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(PERK_CATEGORIES)
  category?: PerkCategory;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  tagline?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  description?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  products?: string[];
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  websiteUrl?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https:\/\/|(?:perks|learnings)\/)[^\s?#]+$/)
  logoUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https:\/\/|(?:perks|learnings)\/)[^\s?#]+$/)
  coverImageUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['coming_soon', 'live'])
  offerStatus?: 'coming_soon' | 'live';
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  userOffer?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  userCouponCode?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  userOfferUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  memberOffer?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  memberCouponCode?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  memberOfferUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  offerTerms?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  offerExpiresAt?: string | null;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isFeatured?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  sortOrder?: number;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
