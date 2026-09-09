import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import type { ArticleStatus } from '@shared/article';

const ARTICLE_STATUSES: ArticleStatus[] = ['draft', 'published'];

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  body?: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  practiceAreaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  countries?: string[];

  @IsOptional()
  @IsString()
  state?: string;

  // Taking effect at all (not just passing validation) is gated in ArticlesService to owner-or-
  // admin. 'published' here means "(re)submit it" — same review-mode resolution as
  // CreateArticleDto.status, see that file's comment.
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ArticleStatus;
}
