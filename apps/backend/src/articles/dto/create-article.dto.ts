import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import type { ArticleCreationMode, ArticleStatus } from '@shared/article';

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
  body!: string;

  @IsUrl()
  coverImageUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  practiceAreaIds!: string[];

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
}
