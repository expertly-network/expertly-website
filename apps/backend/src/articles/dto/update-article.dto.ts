import {
  ArrayMaxSize,
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
import { ALL_COUNTRIES } from '../../ai/countries';
import type { ArticleStatus } from '@shared/article';
import { MAX_ARTICLE_BODY_LENGTH } from '../word-count';
import { MAX_ARTICLE_SERVICES } from './create-article.dto';

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
  @MaxLength(MAX_ARTICLE_BODY_LENGTH)
  body?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ARTICLE_SERVICES)
  @IsUUID('4', { each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsObject()
  customServiceLabels?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_COUNTRIES.length)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  countries?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  // 'published' means (re)submit. Only the owner or an admin may change it.
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ArticleStatus;
}
