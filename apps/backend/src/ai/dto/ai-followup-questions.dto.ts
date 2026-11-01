import { IsString, MaxLength, IsOptional } from 'class-validator';
import { AI_BRIEF_LIMITS as L, WordCount } from './word-limits';

// Parsed from plain JSON via the global ValidationPipe (unlike AiDraftRequestDto, which is
// hand-parsed from a multipart `payload` field — this endpoint takes no files). No
// serviceIds/countries/state — generates purely from the written brief; see
// docs/superpowers/specs/2026-10-04-ai-inferred-article-taxonomy-design.md.
export class AiFollowUpQuestionsDto {
  @IsString()
  @MaxLength(200)
  @WordCount(L.topic.min, L.topic.max)
  topic!: string;

  @IsString()
  @MaxLength(4000)
  @WordCount(L.notes.min, L.notes.max)
  notes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @WordCount(L.recentDevelopments.min, L.recentDevelopments.max)
  recentDevelopments?: string;

  @IsString()
  @MaxLength(4000)
  @WordCount(L.advice.min, L.advice.max)
  advice!: string;
}
