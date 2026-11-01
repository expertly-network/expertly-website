import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AI_BRIEF_LIMITS as L, WordCount } from './word-limits';

// One answered follow-up question, as returned by ai-followup-questions and then answered by the
// member. See AiDraftRequestDto.followUpAnswers below.
export class FollowUpAnswerDto {
  @IsString()
  @MaxLength(300)
  question!: string;

  @IsString()
  @MaxLength(2000)
  @WordCount(L.followUpAnswer.min, L.followUpAnswer.max)
  answer!: string;
}

// Parsed by hand from the multipart request's `payload` field. topic, notes and advice are
// required with minimum word counts (see word-limits.ts). Source files arrive separately as
// the multipart's file parts. No title/serviceIds/countries/state here — the AI infers all of
// those (validated against the real taxonomy) and returns them alongside the draft; see
// AiService.generateDraft and docs/superpowers/specs/2026-10-04-ai-inferred-article-taxonomy-design.md.
export class AiDraftRequestDto {
  /** What the article is about — a topic or working title. The AI still writes the final title. */
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
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

  /** Max 10. Only the follow-up questions the member actually answered — blanks are omitted client-side. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FollowUpAnswerDto)
  followUpAnswers?: FollowUpAnswerDto[];

  /** Max 10. The full question list ai-followup-questions returned — for the audit log only, not the prompt. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  followUpQuestionsAsked?: string[];
}
