import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  // Word-count bound (800-2000, from the design's own validation copy) is
  // checked in ArticlesService, not here — class-validator has no built-in
  // word-count decorator, and this is a one-call-site rule.
  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsUrl()
  coverImageUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  practiceAreaIds!: string[];

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsOptional()
  @IsString()
  state?: string;
}
