import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_ARTICLE_BODY_LENGTH } from '../../articles/word-count';

export class RefineDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ARTICLE_BODY_LENGTH)
  body!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  refinementNotes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;
}
