import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 'pending_review'/'rejected' only occur in editorial review mode.
export type ArticleStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

// Which authoring path produced an article. Descriptive only.
export type ArticleCreationMode = 'manual' | 'ai';

export class ArticlePracticeArea {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class ArticleDto {
  @ApiProperty() id!: string;
  // Server-generated from `title`; stable thereafter.
  @ApiProperty() slug!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
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
  @ApiProperty({ type: () => ArticlePracticeArea, isArray: true }) practiceAreas!: ArticlePracticeArea[];
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
  @ApiProperty({ type: String, isArray: true }) practiceAreaIds!: string[];
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiPropertyOptional() state?: string;
  // Omit to publish (or submit for review); 'draft' skips the word-count check.
  @ApiPropertyOptional({ enum: ['draft', 'published'] }) status?: ArticleStatus;
  @ApiPropertyOptional({ enum: ['manual', 'ai'] }) creationMode?: ArticleCreationMode;
}

// All fields optional; status changes require the owner or an admin.
export type UpdateArticleRequest = Partial<CreateArticleRequest & { status: ArticleStatus }>;

// POST /v1/articles/ai-draft — 🔒 member. Generates a draft; does not save it.
export interface AiDraftArticleRequest {
  title?: string;
  practiceAreaIds: string[];
  countries: string[];
  state?: string;
  notes?: string;
  recentDevelopments?: string;
  advice?: string;
  /** Max 5. The model decides whether to fetch/search each one. */
  sourceLinks?: string[];
  /** Presents a comparison as a table if relevant to the topic. */
  includeVisual?: boolean;
  tone?: string;
  extraInstructions?: string;
}

export class AiDraftArticleResponse {
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
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
  practiceAreaIds?: string[];
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
  @ApiProperty({ type: () => ArticlePracticeArea, isArray: true }) practiceAreas!: ArticlePracticeArea[];
  @ApiProperty({ type: String, isArray: true }) countries!: string[];
  @ApiProperty() createdAt!: string;
}

export class AdminArticleReviewRequest {
  @ApiProperty({ enum: ['published', 'rejected'] }) status!: 'published' | 'rejected';
  /** Required when status is 'rejected'. */
  @ApiPropertyOptional() rejectionReason?: string;
}
