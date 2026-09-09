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

// Arrives as the multipart `payload` field's JSON string (see AdminArticlesController's sibling
// pattern in applications.controller.ts's uploadFile — Fastify never populates req.body from a
// multipart form, so this is validated by hand via plainToInstance+validate, not the global
// ValidationPipe/@Body()). Source files themselves arrive as the multipart's file parts,
// extracted to text server-side (see extract-text.ts) — never a DTO field.
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
