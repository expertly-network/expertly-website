export type ArticleStatus = 'draft' | 'published';

export interface ArticlePracticeArea {
  id: string;
  name: string;
}

export interface ArticleDto {
  id: string;
  authorId: string;
  authorName: string;
  status: ArticleStatus;
  title: string;
  body: string;
  excerpt: string;
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
