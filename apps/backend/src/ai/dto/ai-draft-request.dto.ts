import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

// Parsed by hand from the multipart request's `payload` field. Source files arrive separately as
// the multipart's file parts.
export class AiDraftRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  practiceAreaIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  countries!: string[];

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recentDevelopments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  advice?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  sourceLinks?: string[];

  @IsOptional()
  @IsBoolean()
  includeVisual?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  extraInstructions?: string;
}
