export type ArticleStatus = 'draft' | 'published';

export interface ArticlePracticeArea {
  id: string;
  name: string;
}

export interface ArticleDto {
  id: string;
  // Server-generated from `title` on create, stable thereafter (never regenerated on update) —
  // never client-writable, same posture as member profile slugs.
  slug: string;
  authorId: string;
  authorName: string;
  // Sourced from `member_profiles.photo_url` (falling back to `profiles.avatar_url`) — null
  // when neither is set, in which case the UI falls back to initials.
  authorPhotoUrl: string | null;
  // Sourced from `member_profiles.headline`/`firm_name` — the "designation" line under the
  // author's name (design/static_html/articles.html: `[title, firm].filter(Boolean).join(', ')`).
  // Null for either half when the author hasn't set it.
  authorHeadline: string | null;
  authorFirmName: string | null;
  status: ArticleStatus;
  title: string;
  body: string;
  excerpt: string;
  // A short, genuinely-written 3-point summary (seed data today — see docs/rest-api.md; not a
  // real LLM call, root CLAUDE.md's AI-integration deferral still holds). Rendered as the
  // article detail page's "AI Summary" callout, one bullet per '\n'-separated line. Null for
  // an article that doesn't have one yet.
  aiSummary: string | null;
  readTimeMinutes: number;
  coverImageUrl: string;
  practiceAreas: ArticlePracticeArea[];
  country: string;
  state: string | null;
  createdAt: string;
  updatedAt: string;
}

// List views omit `body` — matches the browse grid's actual card usage.
export type ArticleListItemDto = Omit<ArticleDto, 'body'>;

export interface CreateArticleRequest {
  title: string;
  body: string;
  coverImageUrl: string;
  practiceAreaIds: string[];
  country: string;
  state?: string;
}

// All fields optional; `status` only takes effect for the owner or admin —
// enforced server-side, not expressible in this type.
export type UpdateArticleRequest = Partial<CreateArticleRequest & { status: ArticleStatus }>;
