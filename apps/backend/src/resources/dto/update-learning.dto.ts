import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsIn,
  IsUrl,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ArrayUnique,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { LEARNING_CATEGORIES, type LearningCategory, type ResourceAudience } from '@shared/resource';

export class UpdateLearningDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/\S/)
  title?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  summary?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['youtube', 'file'])
  videoProvider?: 'youtube' | 'file';
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  videoUrl?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https:\/\/|(?:perks|learnings)\/)[^\s?#]+$/)
  thumbnailUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  channel?: string | null;
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(14400)
  durationMinutes?: number;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(LEARNING_CATEGORIES)
  category?: LearningCategory;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['beginner', 'intermediate', 'advanced'])
  level?: 'beginner' | 'intermediate' | 'advanced';
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(['tax', 'legal', 'audit'], { each: true })
  audiences?: ResourceAudience[];
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['auto', 'open', 'members'])
  access?: 'auto' | 'open' | 'members';
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
