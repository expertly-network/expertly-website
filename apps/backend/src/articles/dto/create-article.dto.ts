import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { ArticleCreationMode, ArticleStatus } from '@shared/article';
import { MAX_ARTICLE_BODY_LENGTH } from '../word-count';

const ARTICLE_STATUSES: ArticleStatus[] = ['draft', 'published'];
const CREATION_MODES: ArticleCreationMode[] = ['manual', 'ai'];

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  // Word count (800-2000) is enforced server-side; skipped for drafts.
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ARTICLE_BODY_LENGTH)
  body!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  coverImageUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  serviceIds!: string[];

  @IsOptional()
  @IsObject()
  customServiceLabels?: Record<string, string>;

  // Free-form country names, not ids.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  countries!: string[];

  @IsOptional()
  @IsString()
  state?: string;

  // 'published' means submit; the actual resulting status depends on the review mode.
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ArticleStatus;

  // Descriptive only. Defaults to 'manual'.
  @IsOptional()
  @IsIn(CREATION_MODES)
  creationMode?: ArticleCreationMode;

  // The ai-draft response's generationId. Must be one of the caller's own generations.
  @IsOptional()
  @IsUUID()
  aiGenerationId?: string;
}
