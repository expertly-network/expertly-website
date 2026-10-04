import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 'pending_review'/'rejected' only occur in editorial review mode.
export type ArticleStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

// Which authoring path produced an article. Descriptive only.
export type ArticleCreationMode = 'manual' | 'ai';

export class ArticleService {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() categoryName!: string;
}

export class ArticleDto {
  @ApiProperty() id!: string;
  // Server-generated from `title`; stable thereafter.
  @ApiProperty() slug!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
  // The author's member profile slug, for linking to /members/:slug. Null when the author has
  // no member profile.
  @ApiProperty({ nullable: true, type: String }) authorSlug!: string | null;
  // Null falls back to initials in the UI.
  @ApiProperty({ nullable: true, type: String }) authorPhotoUrl!: string | null;
  // The "designation" line under the author's name.
  @ApiProperty({ nullable: true, type: String }) authorHeadline!: string | null;
  @ApiProperty({ nullable: true, type: String }) authorFirmName!: string | null;
  @ApiProperty({ enum: ['draft', 'pending_review', 'published', 'rejected'] }) status!: ArticleStatus;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() excerpt!: string;
  // Rendered as the article detail page's "AI Summary" callout, one bullet per line.
  @ApiProperty({ nullable: true, type: String }) aiSummary!: string | null;
  @ApiProperty({ enum: ['manual', 'ai'] }) creationMode!: ArticleCreationMode;
  @ApiProperty() readTimeMinutes!: number;
  @ApiProperty() coverImageUrl!: string;
  @ApiProperty({ type: () => ArticleService, isArray: true }) services!: ArticleService[];
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) customServiceLabels!: Record<string, string>;
  // An article can apply to more than one country.
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiProperty({ nullable: true, type: String }) state!: string | null;
  // Set only when status is 'rejected' (editorial review mode); null otherwise.
  @ApiProperty({ nullable: true, type: String }) rejectionReason!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export type ArticleListItemDto = Omit<ArticleDto, 'body'>;

export class CreateArticleRequest {
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() coverImageUrl!: string;
  @ApiProperty({ type: String, isArray: true }) serviceIds!: string[];
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } }) customServiceLabels?: Record<string, string>;
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiPropertyOptional() state?: string;
  // Omit to publish (or submit for review); 'draft' skips the word-count check.
  @ApiPropertyOptional({ enum: ['draft', 'published'] }) status?: ArticleStatus;
  @ApiPropertyOptional({ enum: ['manual', 'ai'] }) creationMode?: ArticleCreationMode;
  /**
   * POST only (ignored on PATCH). The `generationId` from the ai-draft response this article was
   * saved from — links the article to its ai_draft_generations audit row so admins can see the
   * inputs/output it came from. Must be one of the caller's own generations; implies
   * creationMode 'ai'.
   */
  @ApiPropertyOptional() aiGenerationId?: string;
}

// All fields optional; status changes require the owner or an admin.
export type UpdateArticleRequest = Partial<Omit<CreateArticleRequest, 'aiGenerationId'> & { status: ArticleStatus }>;

// POST /v1/articles/ai-draft — 🔒 member. Generates a draft; does not save it. Service(s),
// country/countries, state, and title are no longer client-provided — the AI infers all of them
// (validated against the real taxonomy) and returns them in AiDraftArticleResponse below.
export interface AiDraftArticleRequest {
  notes?: string;
  recentDevelopments?: string;
  advice?: string;
  /** Max 10. Only questions the member actually answered — blank answers are omitted client-side. */
  followUpAnswers?: { question: string; answer: string }[];
  /**
   * Max 10. The full question list ai-followup-questions returned (echoed back as-is, even the
   * ones left blank) — distinct from followUpAnswers so the audit log can tell "asked but
   * skipped" apart from "never asked". Omitted entirely when that endpoint returned zero
   * questions.
   */
  followUpQuestionsAsked?: string[];
  /** Max 5. The model decides whether to fetch/search each one. */
  sourceLinks?: string[];
  /** Presents a comparison as a table if relevant to the topic. */
  includeVisual?: boolean;
  tone?: string;
  extraInstructions?: string;
}

/** POST /v1/articles/ai-draft response's `sources` entries — a URL the model actually fetched/searched. */
export class ArticleSource {
  @ApiProperty() url!: string;
  @ApiProperty() title!: string;
}

// Shared by ai-draft and ai-refine. serviceIds/countries/state/sources only ever come from
// ai-draft — ai-refine never re-infers taxonomy or re-fetches citations (see root
// docs/superpowers/specs/2026-10-04-ai-inferred-article-taxonomy-design.md §2), so they're
// optional here rather than claiming a presence ai-refine's response never actually has.
export class AiDraftArticleResponse {
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  /**
   * ai-draft only (never ai-refine): the id of this attempt's ai_draft_generations audit row.
   * Send it back as CreateArticleRequest.aiGenerationId when saving the article.
   */
  @ApiPropertyOptional() generationId?: string;
  /** URLs the model actually fetched/searched while drafting, if any. Null/empty when none. */
  @ApiPropertyOptional({ type: () => ArticleSource, isArray: true, nullable: true }) sources?: ArticleSource[] | null;
  /** AI-inferred, validated against the real active services list. Empty if nothing matched. */
  @ApiPropertyOptional({ type: String, isArray: true }) serviceIds?: string[];
  /** AI-inferred, validated against the real countries list. Empty if nothing matched. */
  @ApiPropertyOptional({ type: String, isArray: true }) countries?: string[];
  /** AI-inferred if clearly implied, otherwise null. Free text, not validated against a list. */
  @ApiPropertyOptional({ nullable: true, type: String }) state?: string | null;
}

// POST /v1/articles/ai-followup-questions — 🔒 member. Decides whether follow-up questions would
// make the article meaningfully more specific/personal, and if so, asks only those (0-10).
// Generates purely from the written brief — no service/country/state input (see ai-draft above).
export interface AiFollowUpQuestionsRequest {
  notes: string;
  recentDevelopments?: string;
  advice: string;
}

export class AiFollowUpQuestionsResponse {
  @ApiProperty({ type: String, isArray: true }) questions!: string[];
}

// POST /v1/articles/ai-refine — 🔒 member. Revises the current draft based on requested changes.
export interface RefineArticleDraftRequest {
  title: string;
  body: string;
  refinementNotes: string;
  tone?: string;
}

// POST /v1/articles/suggest-topics — 🔒 member. Suggests article title ideas.
export interface SuggestTopicsRequest {
  serviceIds?: string[];
}

export class SuggestTopicsResponse {
  @ApiProperty({ type: String, isArray: true }) topics!: string[];
}

// GET /v1/articles/cover-images?query= — 🔒 member. Unsplash cover image suggestions.
export class CoverImageSuggestionsResponse {
  @ApiProperty({ type: String, isArray: true }) images!: string[];
}

/** GET /v1/admin/articles response row — the review queue's list shape, lighter than ArticleDto. */
export class AdminArticleListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['draft', 'pending_review', 'published', 'rejected'] }) status!: ArticleStatus;
  @ApiProperty() title!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
  @ApiProperty({ type: () => ArticleService, isArray: true }) services!: ArticleService[];
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  /** Set when the article was saved from an AI draft — links to GET /v1/admin/ai-generations/:id. */
  @ApiProperty({ nullable: true, type: String }) aiGenerationId!: string | null;
  @ApiProperty() createdAt!: string;
}

export class AdminArticleReviewRequest {
  @ApiProperty({ enum: ['published', 'rejected'] }) status!: 'published' | 'rejected';
  /** Required when status is 'rejected'. */
  @ApiPropertyOptional() rejectionReason?: string;
}

// ---------------------------------------------------------------------------------------------
// 🛡️ manageArticles — admin AI-generations log (GET /v1/admin/ai-generations[/:id]). One row per
// POST /v1/articles/ai-draft attempt (success or failure), read from ai_draft_generations.
// ---------------------------------------------------------------------------------------------

export type AiGenerationStatus = 'success' | 'failed';

/** The article a generation was saved as, if the member saved it at all. */
export class AiGenerationLinkedArticle {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ['draft', 'pending_review', 'published', 'rejected'] }) status!: ArticleStatus;
}

/** GET /v1/admin/ai-generations response row. */
export class AdminAiGenerationListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
  @ApiProperty({ enum: ['success', 'failed'] }) status!: AiGenerationStatus;
  /** The AI's draft title. Null for a failed attempt. */
  @ApiProperty({ nullable: true, type: String }) draftTitle!: string | null;
  @ApiProperty({ nullable: true, type: String }) provider!: string | null;
  @ApiProperty({ nullable: true, type: String }) model!: string | null;
  @ApiProperty({ nullable: true, type: Number }) latencyMs!: number | null;
  @ApiProperty({ nullable: true, type: String }) errorMessage!: string | null;
  /** Null when the member never saved this draft as an article. */
  @ApiProperty({ nullable: true, type: () => AiGenerationLinkedArticle }) article!: AiGenerationLinkedArticle | null;
  @ApiProperty() createdAt!: string;
}

/** One follow-up question the AI asked; answer is null when the member skipped it. */
export class AiGenerationFollowUp {
  @ApiProperty() question!: string;
  @ApiProperty({ nullable: true, type: String }) answer!: string | null;
}

/** A source file the member uploaded. url is a short-lived signed URL; null if it can't be signed. */
export class AiGenerationSourceFile {
  @ApiProperty() filename!: string;
  @ApiProperty({ nullable: true, type: String }) url!: string | null;
}

/** Everything the member gave the wizard for this attempt. */
export class AiGenerationInputs {
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
  @ApiProperty({ nullable: true, type: String }) recentDevelopments!: string | null;
  @ApiProperty({ nullable: true, type: String }) advice!: string | null;
  /** Every question asked, in order — including skipped ones (answer: null). */
  @ApiProperty({ type: () => AiGenerationFollowUp, isArray: true }) followUps!: AiGenerationFollowUp[];
  @ApiProperty({ type: String, isArray: true }) sourceLinks!: string[];
  @ApiProperty({ type: () => AiGenerationSourceFile, isArray: true }) sourceFiles!: AiGenerationSourceFile[];
  @ApiProperty() includeVisual!: boolean;
  @ApiProperty({ nullable: true, type: String }) tone!: string | null;
  @ApiProperty({ nullable: true, type: String }) extraInstructions!: string | null;
}

/** What the AI returned. All null/empty for a failed attempt. */
export class AiGenerationOutput {
  @ApiProperty({ nullable: true, type: String }) title!: string | null;
  /** Sanitized HTML, same allowlist as ArticleDto.body. */
  @ApiProperty({ nullable: true, type: String }) body!: string | null;
  @ApiProperty({ type: () => ArticleSource, isArray: true }) sources!: ArticleSource[];
  /** AI-inferred services, resolved to names (unknown ids dropped). */
  @ApiProperty({ type: () => ArticleService, isArray: true }) services!: ArticleService[];
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiProperty({ nullable: true, type: String }) state!: string | null;
}

/** GET /v1/admin/ai-generations/:id response. */
export class AdminAiGenerationDetailDto extends AdminAiGenerationListItemDto {
  @ApiProperty({ type: () => AiGenerationInputs }) inputs!: AiGenerationInputs;
  @ApiProperty({ type: () => AiGenerationOutput }) output!: AiGenerationOutput;
}
