import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ArticleStatus = 'draft' | 'published';

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
  @ApiProperty({ enum: ['draft', 'published'] }) status!: ArticleStatus;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() excerpt!: string;
  // A short, genuinely-written 3-point summary (seed data today — see docs/rest-api.md; not a
  // real LLM call, root CLAUDE.md's AI-integration deferral still holds). Rendered as the
  // article detail page's "AI Summary" callout, one bullet per '\n'-separated line. Null for
  // an article that doesn't have one yet.
  @ApiProperty({ nullable: true, type: String }) aiSummary!: string | null;
  @ApiProperty() readTimeMinutes!: number;
  @ApiProperty() coverImageUrl!: string;
  @ApiProperty({ type: () => ArticlePracticeArea, isArray: true }) practiceAreas!: ArticlePracticeArea[];
  @ApiProperty() country!: string;
  @ApiProperty({ nullable: true, type: String }) state!: string | null;
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
  @ApiProperty() country!: string;
  @ApiPropertyOptional() state?: string;
}

// All fields optional; `status` only takes effect for the owner or admin —
// enforced server-side, not expressible in this type.
export type UpdateArticleRequest = Partial<CreateArticleRequest & { status: ArticleStatus }>;
