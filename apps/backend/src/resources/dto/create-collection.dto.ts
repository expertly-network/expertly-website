import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsIn,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ArrayUnique,
  ArrayMaxSize,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { type ResourceAudience } from '@shared/resource';

export class CreateCollectionDto {
  @IsIn(['learning_playlist', 'perk_stack', 'template_kit'])
  kind!: 'learning_playlist' | 'perk_stack' | 'template_kit';
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/\S/)
  title!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  description?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(['tax', 'legal', 'audit'], { each: true })
  audiences?: ResourceAudience[];
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  itemIds?: string[];
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https:\/\/|(?:perks|learnings)\/)[^\s?#]+$/)
  coverImageUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  sortOrder?: number;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
