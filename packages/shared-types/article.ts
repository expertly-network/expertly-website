import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// pending_review/rejected back ARTICLES_REVIEW_MODE=editorial in ArticlesService — in the
// default 'instant' mode, submissions still go straight to 'published' and these two values are
// simply never produced. See docs/database-erd.md.
export type ArticleStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

// Which authoring path produced an article — 'ai' means it started from a POST
// /v1/articles/ai-draft response (see AiDraftArticleRequest/Response below), whether or not
// the member edited it before saving. Purely descriptive, not an authorization signal.
export type ArticleCreationMode = 'manual' | 'ai';

export class ArticlePracticeArea {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class ArticleDto {
  @ApiProperty() id!: string;
  // Server-generated from `title` on create, stable thereafter (never regenerated on update) —
  // never client-writable, same posture as member profile slugs.
  @ApiProperty() slug!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
  // Sourced from `member_profiles.photo_url` (falling back to `profiles.avatar_url`) — null
  // when neither is set, in which case the UI falls back to initials.
  @ApiProperty({ nullable: true, type: String }) authorPhotoUrl!: string | null;
  // Sourced from `member_profiles.headline`/`firm_name` — the "designation" line under the
  // author's name (design/static_html/articles.html: `[title, firm].filter(Boolean).join(', ')`).
  // Null for either half when the author hasn't set it.
  @ApiProperty({ nullable: true, type: String }) authorHeadline!: string | null;
  @ApiProperty({ nullable: true, type: String }) authorFirmName!: string | null;
  @ApiProperty({ enum: ['draft', 'pending_review', 'published', 'rejected'] }) status!: ArticleStatus;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() excerpt!: string;
  // A short, genuinely-written 3-point summary (seed data today — see docs/rest-api.md; not a
  // real LLM call, root CLAUDE.md's AI-integration deferral still holds). Rendered as the
  // article detail page's "AI Summary" callout, one bullet per '\n'-separated line. Null for
  // an article that doesn't have one yet.
  @ApiProperty({ nullable: true, type: String }) aiSummary!: string | null;
  @ApiProperty({ enum: ['manual', 'ai'] }) creationMode!: ArticleCreationMode;
  @ApiProperty() readTimeMinutes!: number;
  @ApiProperty() coverImageUrl!: string;
  @ApiProperty({ type: () => ArticlePracticeArea, isArray: true }) practiceAreas!: ArticlePracticeArea[];
  // Genuinely multi-select — an article can apply to more than one country, same array/no-FK
  // trade-off as practiceAreas above (see docs/database-erd.md).
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiProperty({ nullable: true, type: String }) state!: string | null;
  // Set only when status is 'rejected' (editorial review mode); null otherwise.
  @ApiProperty({ nullable: true, type: String }) rejectionReason!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

// List views omit `body` — matches the browse grid's actual card usage.
export type ArticleListItemDto = Omit<ArticleDto, 'body'>;

export class CreateArticleRequest {
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() coverImageUrl!: string;
  @ApiProperty({ type: String, isArray: true }) practiceAreaIds!: string[];
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiPropertyOptional() state?: string;
  // Omit for the existing "publish immediately" behavior (or whatever ARTICLES_REVIEW_MODE
  // resolves 'submitted' to server-side — see ArticlesService); pass 'draft' to save a
  // work-in-progress (skips the 800–2000 word-count check until it's actually published).
  @ApiPropertyOptional({ enum: ['draft', 'published'] }) status?: ArticleStatus;
  @ApiPropertyOptional({ enum: ['manual', 'ai'] }) creationMode?: ArticleCreationMode;
}

// All fields optional; `status` only takes effect for the owner or admin —
// enforced server-side, not expressible in this type.
export type UpdateArticleRequest = Partial<CreateArticleRequest & { status: ArticleStatus }>;

// POST /v1/articles/ai-draft — 🔒 member. The AI wizard's 3-step brief; generates a title+body
// using the backend's fixed (env-configured) AI_PROVIDER/AI_MODEL, returns the draft for the
// member to review/edit client-side, does NOT save an article. Save the result via
// POST /v1/articles with creationMode: 'ai' once the member is happy with it.
//
// Sent as the multipart `payload` field's JSON string, not a plain JSON body — source documents
// (step 3's dropzone) travel as sibling file parts in the same multipart request, extracted to
// text server-side and never persisted. See docs/rest-api.md for the exact multipart shape.
export interface AiDraftArticleRequest {
  title?: string;
  practiceAreaIds: string[];
  countries: string[];
  state?: string;
  notes?: string;
  recentDevelopments?: string;
  advice?: string;
  /** Fetched server-side (SSRF-guarded) and folded into the prompt; max 5. */
  sourceLinks?: string[];
  /** Include one markdown table if genuinely relevant — no real image generation exists in this
   * repo (see root CLAUDE.md's AI-integration deferral), so this never produces an illustration. */
  includeVisual?: boolean;
  tone?: string;
  extraInstructions?: string;
}

export class AiDraftArticleResponse {
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
}

// POST /v1/articles/ai-refine — 🔒 member. Re-prompts the model against the current draft plus
// the member's requested changes (the wizard's "refine" box). Plain JSON, unlike ai-draft above.
export interface RefineArticleDraftRequest {
  title: string;
  body: string;
  refinementNotes: string;
  tone?: string;
}

// POST /v1/articles/suggest-topics — 🔒 member. The "Stuck? Try a topic" chip row's AI-generated
// title ideas (replacing the earlier local-template version) — one real model call, not saved
// anywhere. `practiceAreaIds` optional: with none selected yet, the backend picks a random
// sample of active practice areas itself so the member still gets ideas before choosing any.
export interface SuggestTopicsRequest {
  practiceAreaIds?: string[];
}

export class SuggestTopicsResponse {
  @ApiProperty({ type: String, isArray: true }) topics!: string[];
}

// GET /v1/articles/cover-images?query= — 🔒 member. Live Unsplash search (replacing the earlier
// curated-list version) — proxied through the backend so the Unsplash access key never reaches
// the client. Returns a handful of candidate URLs; "shuffle" cycles through them client-side
// rather than re-querying on every click.
export class CoverImageSuggestionsResponse {
  @ApiProperty({ type: String, isArray: true }) images!: string[];
}

/**
 * GET /v1/admin/articles response row — the editorial review queue's list shape, lighter than
 * the full ArticleDto (no body). 🛡️ manageArticles. Only ever non-empty when
 * ARTICLES_REVIEW_MODE=editorial — in 'instant' mode nothing reaches 'pending_review'.
 */
export class AdminArticleListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['draft', 'pending_review', 'published', 'rejected'] }) status!: ArticleStatus;
  @ApiProperty() title!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
  @ApiProperty({ type: () => ArticlePracticeArea, isArray: true }) practiceAreas!: ArticlePracticeArea[];
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiProperty() createdAt!: string;
}

export class AdminArticleReviewRequest {
  @ApiProperty({ enum: ['published', 'rejected'] }) status!: 'published' | 'rejected';
  /** Required when status is 'rejected'. */
  @ApiPropertyOptional() rejectionReason?: string;
}
