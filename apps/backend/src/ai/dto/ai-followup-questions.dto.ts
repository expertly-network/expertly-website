import { IsString, MaxLength, IsOptional } from 'class-validator';

// Parsed from plain JSON via the global ValidationPipe (unlike AiDraftRequestDto, which is
// hand-parsed from a multipart `payload` field — this endpoint takes no files). No
// serviceIds/countries/state — generates purely from the written brief; see
// docs/superpowers/specs/2026-10-04-ai-inferred-article-taxonomy-design.md.
export class AiFollowUpQuestionsDto {
  @IsString()
  @MaxLength(4000)
  notes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recentDevelopments?: string;

  @IsString()
  @MaxLength(4000)
  advice!: string;
}
