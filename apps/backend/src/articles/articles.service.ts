import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminArticleListItemDto,
  ArticleDto,
  ArticleListItemDto,
  ArticlePracticeArea,
  ArticleStatus,
} from '@shared/article';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AdminArticleReviewDto } from './dto/admin-article-review.dto';
import { sanitizeArticleBody } from './sanitize-article-body';
import { AiService } from '../ai/ai.service';
import { ArticlesRepository, type ArticleRow, type AuthorInfo } from './articles.repository';

const MIN_WORDS = 400;
const MAX_WORDS = 2000;
const EXCERPT_LENGTH = 200;

type ArticlesReviewMode = 'instant' | 'editorial';

// Word count / excerpt are derived from the sanitised body's plain text, not the raw HTML — so
// tags don't inflate the word count and the excerpt doesn't contain stray markup.
function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  // Read once per instance, not per request — a running instance's review mode doesn't change
  // mid-flight. Defaults to 'instant' (today's only behavior) when unset, so existing deployments
  // don't need an env change to keep working.
  private readonly reviewMode: ArticlesReviewMode =
    process.env.ARTICLES_REVIEW_MODE === 'editorial' ? 'editorial' : 'instant';

  constructor(
    private readonly repository: ArticlesRepository,
    private readonly ai: AiService
  ) {}

  // The one place a client-requested "make this live" ('published' on the DTO, meaning
  // "submit") gets resolved to the real resulting status — a client can never set
  // 'pending_review'/'rejected' directly, only 'draft' or "submit" (see Create/UpdateArticleDto's
  // comments). Word-count is still asserted against the submitted body either way.
  private resolveSubmitStatus(): ArticleStatus {
    return this.reviewMode === 'editorial' ? 'pending_review' : 'published';
  }

  async create(user: AuthenticatedUser, dto: CreateArticleDto): Promise<ArticleDto> {
    const status: ArticleStatus = dto.status === 'draft' ? 'draft' : this.resolveSubmitStatus();
    const body = sanitizeArticleBody(dto.body);
    // A draft-in-progress can be any length — the word-count bound only guards what actually
    // gets submitted/published, checked again in update() if/when a draft's status flips.
    if (status !== 'draft') assertWordCount(body);
    await this.assertActivePracticeAreaIds(dto.practiceAreaIds);
    const slug = await this.repository.findUniqueSlug(dto.title);

    const row = await this.repository.insert({
      slug,
      author_id: user.id,
      status,
      title: dto.title,
      body,
      excerpt: deriveExcerpt(body),
      read_time_minutes: deriveReadTimeMinutes(body),
      cover_image_url: dto.coverImageUrl,
      practice_area_ids: dto.practiceAreaIds,
      countries: dto.countries,
      state: dto.state ?? null,
      creation_mode: dto.creationMode ?? 'manual',
    });

    this.generateSummaryIfNeeded(row);
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthors([user.id]),
    ]);
    return toDto(row, practiceAreaNames, authors);
  }

  async listPublished(authorId?: string): Promise<ArticleListItemDto[]> {
    const rows = await this.repository.findPublished(authorId);
    return this.toListDtos(rows);
  }

  async listMine(user: AuthenticatedUser): Promise<ArticleListItemDto[]> {
    const rows = await this.repository.findAllByAuthor(user.id);
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(rows.flatMap((r) => r.practice_area_ids)),
      this.resolveAuthors([user.id]),
    ]);
    return rows.map((row) => omitBody(toDto(row, practiceAreaNames, authors)));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ArticleDto> {
    const row = await this.repository.findByIdOrThrow(id);

    if (row.status !== 'published' && row.author_id !== user.id && user.role !== 'admin') {
      throw new NotFoundException('Article not found.');
    }

    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthors([row.author_id]),
    ]);
    return toDto(row, practiceAreaNames, authors);
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateArticleDto): Promise<ArticleDto> {
    const existing = await this.repository.findByIdOrThrow(id);
    this.assertOwnerOrAdmin(existing, user);
    const body = dto.body !== undefined ? sanitizeArticleBody(dto.body) : undefined;
    const resultingStatus: ArticleStatus | undefined = dto.status === undefined ? undefined : dto.status === 'draft' ? 'draft' : this.resolveSubmitStatus();
    const effectiveStatus = resultingStatus ?? existing.status;
    if (effectiveStatus !== 'draft') assertWordCount(body ?? existing.body);
    if (dto.practiceAreaIds !== undefined) {
      await this.assertActivePracticeAreaIds(dto.practiceAreaIds);
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (body !== undefined) {
      patch.body = body;
      patch.excerpt = deriveExcerpt(body);
      patch.read_time_minutes = deriveReadTimeMinutes(body);
    }
    if (dto.coverImageUrl !== undefined) patch.cover_image_url = dto.coverImageUrl;
    if (dto.practiceAreaIds !== undefined) patch.practice_area_ids = dto.practiceAreaIds;
    if (dto.countries !== undefined) patch.countries = dto.countries;
    if (dto.state !== undefined) patch.state = dto.state;
    if (resultingStatus !== undefined) {
      patch.status = resultingStatus;
      // A fresh (re)submission clears any earlier rejection reason — it no longer describes
      // the article being submitted now.
      if (resultingStatus !== 'draft') patch.rejection_reason = null;
    }

    const row = await this.repository.updateById(id, patch);

    this.generateSummaryIfNeeded(row);
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthors([row.author_id]),
    ]);
    return toDto(row, practiceAreaNames, authors);
  }

  // 🛡️ manageArticles — the editorial review queue's list view. Defaults to 'pending_review'
  // (the actual queue); pass `status` to look at a specific bucket instead, e.g. 'rejected' to
  // audit past decisions. Only ever non-empty when ARTICLES_REVIEW_MODE=editorial — in 'instant'
  // mode nothing reaches 'pending_review'. Lighter than toDto()'s full ArticleDto (no body).
  async listForReview(status?: ArticleStatus): Promise<AdminArticleListItemDto[]> {
    const rows = await this.repository.findForReview(status);
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(rows.flatMap((r) => r.practice_area_ids)),
      this.resolveAuthors(rows.map((r) => r.author_id)),
    ]);

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      title: row.title,
      authorId: row.author_id,
      authorName: authors.get(row.author_id)?.name ?? 'Expertly Member',
      practiceAreas: row.practice_area_ids
        .filter((id) => practiceAreaNames.has(id))
        .map((id) => ({ id, name: practiceAreaNames.get(id)! })),
      countries: row.countries,
      createdAt: row.created_at,
    }));
  }

  // 🛡️ manageArticles — approve publishes immediately; reject requires a reason and returns the
  // article to the author (visible only to them, same as any other non-published status).
  async review(id: string, dto: AdminArticleReviewDto): Promise<ArticleDto> {
    const existing = await this.repository.findByIdOrThrow(id);
    if (existing.status !== 'pending_review') {
      throw new BadRequestException('Only an article pending review can be approved or rejected.');
    }
    if (dto.status === 'rejected' && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required.');
    }

    const row = await this.repository.applyReview(id, {
      status: dto.status,
      rejection_reason: dto.status === 'rejected' ? dto.rejectionReason!.trim() : null,
    });

    this.generateSummaryIfNeeded(row);
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthors([row.author_id]),
    ]);
    return toDto(row, practiceAreaNames, authors);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.repository.findByIdOrThrow(id);
    this.assertOwnerOrAdmin(existing, user);
    await this.repository.deleteById(id);
  }

  private async toListDtos(rows: ArticleRow[]): Promise<ArticleListItemDto[]> {
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(rows.flatMap((r) => r.practice_area_ids)),
      this.resolveAuthors(rows.map((r) => r.author_id)),
    ]);
    return rows.map((row) => omitBody(toDto(row, practiceAreaNames, authors)));
  }

  // Fires the first time an article becomes 'published' (ai_summary still null) — never on a
  // later edit to an already-published article, and never awaited by the caller: the publish/
  // approve response must return immediately regardless of whether the LLM call succeeds. Errors
  // are logged and swallowed here, same graceful-degrade posture as AiService's other callers.
  private generateSummaryIfNeeded(row: ArticleRow): void {
    if (row.status !== 'published' || row.ai_summary !== null) return;

    void this.ai
      .summarizeArticle(row.title, row.body)
      .then((summary) => this.repository.updateAiSummary(row.id, summary))
      .catch((error) => {
        this.logger.error(
          `AI summary generation failed for article ${row.id}`,
          error instanceof Error ? error.stack : error
        );
      });
  }

  private assertOwnerOrAdmin(row: ArticleRow, user: AuthenticatedUser): void {
    if (row.author_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You can only modify your own articles.');
    }
  }

  private async assertActivePracticeAreaIds(ids: string[]): Promise<void> {
    const validIds = await this.repository.findActivePracticeAreaIds(ids);
    const invalidIds = ids.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid or inactive practice area id(s): ${invalidIds.join(', ')}`);
    }
  }

  // Used by AiService (via ArticlesController.aiDraft) to build the AI wizard's prompt from the
  // ids the client selected in step 1 of the form — practice area *names*, not ids, are what
  // belong in a natural-language prompt. Thin wrapper over resolvePracticeAreaNames below so the
  // one query isn't duplicated in AiService.
  async resolvePracticeAreaNamesList(ids: string[]): Promise<string[]> {
    const map = await this.resolvePracticeAreaNames(ids);
    return ids.map((id) => map.get(id)).filter((name): name is string => Boolean(name));
  }

  private async resolvePracticeAreaNames(ids: string[]): Promise<Map<string, string>> {
    return this.repository.findPracticeAreaNames(ids);
  }

  private async resolveAuthors(ids: string[]): Promise<Map<string, AuthorInfo>> {
    return this.repository.findAuthorsInfo(ids);
  }
}

// `body` here is already-sanitised HTML — these all derive from its plain-text content so tags
// don't inflate the word count or leak into the excerpt.
function assertWordCount(body: string): void {
  const wordCount = countWords(body);
  if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
    throw new BadRequestException(
      `Article body must be between ${MIN_WORDS} and ${MAX_WORDS} words (got ${wordCount}).`
    );
  }
}

function deriveExcerpt(body: string): string {
  const trimmed = stripHtml(body).trim().replace(/\s+/g, ' ');
  if (trimmed.length <= EXCERPT_LENGTH) return trimmed;
  const truncated = trimmed.slice(0, EXCERPT_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : EXCERPT_LENGTH)}…`;
}

function deriveReadTimeMinutes(body: string): number {
  return Math.max(1, Math.round(countWords(body) / 200));
}

function countWords(body: string): number {
  return stripHtml(body)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function omitBody(dto: ArticleDto): ArticleListItemDto {
  const { body: _body, ...rest } = dto;
  return rest;
}

function toDto(
  row: ArticleRow,
  practiceAreaNames: Map<string, string>,
  authors: Map<string, AuthorInfo>
): ArticleDto {
  const practiceAreas: ArticlePracticeArea[] = row.practice_area_ids
    .filter((id) => practiceAreaNames.has(id))
    .map((id) => ({ id, name: practiceAreaNames.get(id)! }));
  const author = authors.get(row.author_id);

  return {
    id: row.id,
    slug: row.slug,
    authorId: row.author_id,
    authorName: author?.name ?? 'Expertly Member',
    authorPhotoUrl: author?.photoUrl ?? null,
    authorHeadline: author?.headline ?? null,
    authorFirmName: author?.firmName ?? null,
    status: row.status,
    title: row.title,
    body: row.body,
    excerpt: row.excerpt,
    aiSummary: row.ai_summary,
    creationMode: row.creation_mode,
    readTimeMinutes: row.read_time_minutes,
    coverImageUrl: row.cover_image_url,
    practiceAreas,
    countries: row.countries,
    state: row.state,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
