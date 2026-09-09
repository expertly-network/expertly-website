import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import type { ArticleCreationMode, ArticleStatus } from '@shared/article';

const ARTICLE_STATUSES: ArticleStatus[] = ['draft', 'published'];
const CREATION_MODES: ArticleCreationMode[] = ['manual', 'ai'];

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  // Word-count bound (800-2000, from the design's own validation copy) is checked in
  // ArticlesService, not here — class-validator has no built-in word-count decorator, and
  // it's skipped entirely for `status: 'draft'` (a work-in-progress draft can be short; the
  // bound only applies once it's actually published).
  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsUrl()
  coverImageUrl!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  practiceAreaIds!: string[];

  // Genuinely multi-select, same array/no-FK trade-off as practiceAreaIds — free-form country
  // names (not ids), so no live-validation query on write, unlike practiceAreaIds.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  countries!: string[];

  @IsOptional()
  @IsString()
  state?: string;

  // 'published' here means "submit it" — the service resolves the *actual* resulting status
  // (published vs. pending_review) from ARTICLES_REVIEW_MODE; the client never chooses between
  // those two directly. Only 'draft' needs to be explicit; omitting this field means "submit"
  // (unchanged from before the review-mode toggle existed).
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ArticleStatus;

  // Purely descriptive (which authoring path produced this row) — not used for any
  // authorization or business-logic decision, so accepting it from the client is fine, unlike
  // a real computed field. Defaults to 'manual'.
  @IsOptional()
  @IsIn(CREATION_MODES)
  creationMode?: ArticleCreationMode;
}
