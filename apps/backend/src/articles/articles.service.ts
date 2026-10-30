import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdminAccessService } from '../auth/admin-access.service';
import { env } from '../config/env';
import { withUniqueSlugRetry } from '../common/slugify';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminArticleListItemDto,
  ArticleDto,
  ArticleListItemDto,
  ArticleService,
  ArticleStatus,
} from '@shared/article';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AdminArticleReviewDto } from './dto/admin-article-review.dto';
import { sanitizeArticleBody } from './sanitize-article-body';
import { countArticleWords, stripHtml, MAX_ARTICLE_WORDS, MIN_ARTICLE_WORDS } from './word-count';
import { AiService } from '../ai/ai.service';
import { AiDraftGenerationsRepository } from '../ai/ai-draft-generations.repository';
import {
  ArticlesRepository,
  type ArticleListRow,
  type ArticleRow,
  type ArticleUpdate,
  type PublishedArticleFilters,
  type AuthorInfo,
  type ServiceDetail,
} from './articles.repository';

const EXCERPT_LENGTH = 200;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

export interface ListPublishedQuery extends PublishedArticleFilters {
  page?: number;
  pageSize?: number;
}

type ArticlesReviewMode = 'instant' | 'editorial';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  // Validated at boot (src/config/env.ts); defaults to 'instant' when ARTICLES_REVIEW_MODE is unset.
  private readonly reviewMode: ArticlesReviewMode = env().ARTICLES_REVIEW_MODE;

  // Article ids with a summary call running (per API instance), so overlapping saves don't each
  // pay for one.
  private readonly summariesInFlight = new Set<string>();

  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly aiService: AiService,
    private readonly aiDraftGenerationsRepository: AiDraftGenerationsRepository,
    private readonly adminAccess: AdminAccessService
  ) {}

  // Resolves a submission to 'published' or 'pending_review' based on the review mode.
  private resolveSubmitStatus(): ArticleStatus {
    return this.reviewMode === 'editorial' ? 'pending_review' : 'published';
  }

  async findOne(idOrSlug: string, user: AuthenticatedUser): Promise<ArticleDto> {
    const row = await this.articlesRepository.findByIdOrSlugOrThrow(idOrSlug);

    // Someone else's article is visible only when published by a still-listed author (active,
    // not deleted, member profile not deactivated) — the same rule the list and preview apply.
    // A manageArticles admin sees everything.
    if (row.author_id !== user.id) {
      const visible = row.status === 'published' && (await this.articlesRepository.isAuthorListed(row.author_id));
      if (!visible && !(await this.adminAccess.hasFreshPermission(user, 'manageArticles'))) {
        throw new NotFoundException({ code: 'ARTICLE_NOT_FOUND', message: 'Article not found.' });
      }
    }

    const [serviceDetails, authors] = await Promise.all([
      this.resolveServiceDetails(row.service_ids),
      this.resolveAuthors([row.author_id]),
    ]);
    return toDto(row, serviceDetails, authors);
  }

  // Always paged: `pageSize` defaults to DEFAULT_PAGE_SIZE when a page is asked for, and to
  // MAX_PAGE_SIZE when neither is given (callers that want "everything", e.g. an author's tab),
  // so no request returns an unbounded list.
  async listPublished(query: ListPublishedQuery): Promise<{ items: ArticleListItemDto[]; total: number }> {
    const { page, pageSize, ...filters } = query;
    const fallbackSize = page === undefined && pageSize === undefined ? MAX_PAGE_SIZE : DEFAULT_PAGE_SIZE;
    const size = Math.min(Math.max(pageSize ?? fallbackSize, 1), MAX_PAGE_SIZE);
    const from = (Math.max(page ?? 1, 1) - 1) * size;
    const range = { from, to: from + size - 1 };
    const { rows, total } = await this.articlesRepository.findPublished(filters, range);
    return { items: await this.toListDtos(rows), total };
  }

  // Public teaser (no body) of one published article, for signed-out visitors and link previews.
  async findPublishedPreview(idOrSlug: string): Promise<ArticleListItemDto> {
    const row = await this.articlesRepository.findPublishedPreview(idOrSlug);
    if (!row) throw new NotFoundException({ code: 'ARTICLE_NOT_FOUND', message: 'Article not found.' });
    const [item] = await this.toListDtos([row]);
    return item;
  }

  async listMine(user: AuthenticatedUser): Promise<ArticleListItemDto[]> {
    const rows = await this.articlesRepository.findAllByAuthor(user.id);
    const [serviceDetails, authors] = await Promise.all([
      this.resolveServiceDetails(rows.flatMap((r) => r.service_ids)),
      this.resolveAuthors([user.id]),
    ]);
    return rows.map((row) => toListDto(row, serviceDetails, authors));
  }

  async create(user: AuthenticatedUser, dto: CreateArticleDto): Promise<ArticleDto> {
    const status: ArticleStatus = dto.status === 'draft' ? 'draft' : this.resolveSubmitStatus();
    const body = sanitizeArticleBody(dto.body);
    if (status !== 'draft') assertWordCount(body);
    await this.assertActiveServiceIds(dto.serviceIds, dto.customServiceLabels);
    const aiGenerationId = dto.aiGenerationId ? await this.resolveOwnAiGenerationId(dto.aiGenerationId, user.id) : null;
    // Retries with a fresh slug when the insert loses a slug race (the repository must surface a
    // 23505 on slug as SlugTakenException for the retry to engage).
    const row = await withUniqueSlugRetry(
      () => this.articlesRepository.findUniqueSlug(dto.title),
      (slug) =>
        this.articlesRepository.insert({
          slug,
          author_id: user.id,
          status,
          title: dto.title,
          body,
          excerpt: deriveExcerpt(body),
          read_time_minutes: deriveReadTimeMinutes(body),
          cover_image_url: dto.coverImageUrl,
          service_ids: dto.serviceIds,
          custom_service_labels: dto.customServiceLabels ?? {},
          countries: dto.countries,
          state: dto.state ?? null,
          creation_mode: aiGenerationId ? 'ai' : (dto.creationMode ?? 'manual'),
          ai_generation_id: aiGenerationId,
        })
    );

    this.generateSummaryIfNeeded(row, { becamePublished: true, textChanged: false });
    const [serviceDetails, authors] = await Promise.all([
      this.resolveServiceDetails(row.service_ids),
      this.resolveAuthors([user.id]),
    ]);
    return toDto(row, serviceDetails, authors);
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateArticleDto): Promise<ArticleDto> {
    const existing = await this.articlesRepository.findByIdOrThrow(id);
    await this.assertCanModify(existing, user);
    const body = dto.body !== undefined ? sanitizeArticleBody(dto.body) : undefined;
    let resultingStatus: ArticleStatus | undefined =
      dto.status === undefined ? undefined : dto.status === 'draft' ? 'draft' : this.resolveSubmitStatus();
    // Editorial mode: an author editing the content of an already-published article sends it
    // back for review — otherwise approval could be bypassed by publishing something harmless
    // and editing it afterwards. (Admins editing someone else's article keep its status.)
    // "Content" is everything the public article page/card renders: title, body, cover, services
    // (customServiceLabels only ever change together with serviceIds) and countries. `state` is
    // stored but not shown publicly, so it doesn't count.
    const changesContent =
      dto.title !== undefined ||
      dto.body !== undefined ||
      dto.coverImageUrl !== undefined ||
      dto.serviceIds !== undefined ||
      dto.countries !== undefined;
    if (
      resultingStatus === undefined &&
      existing.status === 'published' &&
      this.reviewMode === 'editorial' &&
      existing.author_id === user.id &&
      changesContent
    ) {
      resultingStatus = 'pending_review';
    }
    const effectiveStatus = resultingStatus ?? existing.status;
    if (effectiveStatus !== 'draft') assertWordCount(body ?? existing.body);
    if (dto.serviceIds !== undefined) {
      await this.assertActiveServiceIds(dto.serviceIds, dto.customServiceLabels);
    }

    const patch: ArticleUpdate = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (body !== undefined) {
      patch.body = body;
      patch.excerpt = deriveExcerpt(body);
      patch.read_time_minutes = deriveReadTimeMinutes(body);
    }
    if (dto.coverImageUrl !== undefined) patch.cover_image_url = dto.coverImageUrl;
    if (dto.serviceIds !== undefined) patch.service_ids = dto.serviceIds;
    if (dto.serviceIds !== undefined) patch.custom_service_labels = dto.customServiceLabels ?? {};
    if (dto.countries !== undefined) patch.countries = dto.countries;
    if (dto.state !== undefined) patch.state = dto.state;
    if (resultingStatus !== undefined) {
      patch.status = resultingStatus;
      // Clears any earlier rejection reason on resubmission.
      if (resultingStatus !== 'draft') patch.rejection_reason = null;
    }

    const row = await this.articlesRepository.updateById(id, patch);

    const textChanged =
      (dto.title !== undefined && dto.title !== existing.title) || (body !== undefined && body !== existing.body);
    this.generateSummaryIfNeeded(row, { becamePublished: existing.status !== 'published', textChanged });
    const [serviceDetails, authors] = await Promise.all([
      this.resolveServiceDetails(row.service_ids),
      this.resolveAuthors([row.author_id]),
    ]);
    return toDto(row, serviceDetails, authors);
  }

  // 🛡️ manageArticles — defaults to the pending_review queue.
  async listForReview(status?: ArticleStatus): Promise<AdminArticleListItemDto[]> {
    const rows = await this.articlesRepository.findForReview(status);
    const [serviceDetails, authors] = await Promise.all([
      this.resolveServiceDetails(rows.flatMap((r) => r.service_ids)),
      this.resolveAuthors(rows.map((r) => r.author_id)),
    ]);

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      title: row.title,
      authorId: row.author_id,
      authorName: authors.get(row.author_id)?.name ?? 'GrowXQ Member',
      services: row.service_ids
        .filter((id) => serviceDetails.has(id))
        .map((id) => {
          const d = serviceDetails.get(id)!;
          return { id, name: d.name, categoryId: d.categoryId, categoryName: d.categoryName };
        }),
      countries: row.countries,
      aiGenerationId: row.ai_generation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // 🛡️ manageArticles — approves or rejects a pending article.
  async review(id: string, dto: AdminArticleReviewDto): Promise<ArticleDto> {
    const existing = await this.articlesRepository.findByIdOrThrow(id);
    if (existing.status !== 'pending_review') {
      throw new BadRequestException({
        code: 'ARTICLE_NOT_PENDING_REVIEW',
        message: 'Only an article pending review can be approved or rejected.',
      });
    }
    if (dto.status === 'rejected' && !dto.rejectionReason?.trim()) {
      throw new BadRequestException({
        code: 'REJECTION_REASON_REQUIRED',
        message: 'A rejection reason is required.',
      });
    }

    // Conditional on the article still pending (and, when sent, unchanged since the reviewer
    // loaded it) — an author can't swap the content, or withdraw it, between view and decision.
    const row = await this.articlesRepository.applyReview(
      id,
      { status: dto.status, rejection_reason: dto.status === 'rejected' ? dto.rejectionReason!.trim() : null },
      dto.expectedUpdatedAt
    );
    if (!row) {
      throw new ConflictException({
        code: 'ARTICLE_CHANGED_SINCE_REVIEW',
        message: 'The article changed after you opened it — reload and review the current version.',
      });
    }

    this.generateSummaryIfNeeded(row, { becamePublished: true, textChanged: false });
    const [serviceDetails, authors] = await Promise.all([
      this.resolveServiceDetails(row.service_ids),
      this.resolveAuthors([row.author_id]),
    ]);
    return toDto(row, serviceDetails, authors);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.articlesRepository.findByIdOrThrow(id);
    await this.assertCanModify(existing, user);
    await this.articlesRepository.deleteById(id);
  }

  private async toListDtos(rows: ArticleListRow[]): Promise<ArticleListItemDto[]> {
    const [serviceDetails, authors] = await Promise.all([
      this.resolveServiceDetails(rows.flatMap((r) => r.service_ids)),
      this.resolveAuthors(rows.map((r) => r.author_id)),
    ]);
    return rows.map((row) => toListDto(row, serviceDetails, authors));
  }

  // Generates the AI summary (a paid LLM call) only on an event that warrants one: the article
  // just became published without a summary, or a published article's title/body changed (the old
  // summary is stale). A PATCH that touches neither never triggers a call, even while ai_summary
  // is still null after an earlier failure. One call per article at a time. Not awaited — errors
  // are logged and otherwise ignored.
  private generateSummaryIfNeeded(row: ArticleRow, change: { becamePublished: boolean; textChanged: boolean }): void {
    if (row.status !== 'published') return;
    const needed = (change.becamePublished && row.ai_summary === null) || change.textChanged;
    if (!needed || this.summariesInFlight.has(row.id)) return;

    this.summariesInFlight.add(row.id);
    void this.aiService
      .summarizeArticle(row.title, row.body)
      .then((summary) => this.articlesRepository.updateAiSummary(row.id, summary))
      .catch((error) => {
        this.logger.error(
          `AI summary generation failed for article ${row.id}`,
          error instanceof Error ? error.stack : error
        );
      })
      .finally(() => this.summariesInFlight.delete(row.id));
  }

  // A generation id that belongs to someone else is a client error. One that doesn't exist at
  // all is tolerated (saved as null): the audit insert is fire-and-forget and may have failed,
  // and that must never stop the member from saving their article.
  private async resolveOwnAiGenerationId(generationId: string, authorId: string): Promise<string | null> {
    const generationAuthorId = await this.aiDraftGenerationsRepository.findAuthorId(generationId);
    if (generationAuthorId === null) {
      this.logger.warn(`aiGenerationId ${generationId} not found — saving article without the link.`);
      return null;
    }
    if (generationAuthorId !== authorId) {
      throw new BadRequestException({
        code: 'AI_GENERATION_NOT_OWNER',
        message: 'aiGenerationId does not belong to you.',
      });
    }
    return generationId;
  }

  // The author, or an admin with manageArticles confirmed fresh from the DB (not the JWT claim).
  private async assertCanModify(row: ArticleRow, user: AuthenticatedUser): Promise<void> {
    if (row.author_id === user.id) return;
    if (await this.adminAccess.hasFreshPermission(user, 'manageArticles')) return;
    throw new ForbiddenException({
      code: 'ARTICLE_NOT_OWNER',
      message: 'You can only modify your own articles.',
    });
  }

  private async assertActiveServiceIds(ids: string[], customLabels?: Record<string, string>): Promise<void> {
    // @IsObject() can't type the values: every label must be short text (a non-string reached
    // `.trim()` below as a 500).
    const labels = Object.values(customLabels ?? {});
    if (labels.length > 20 || labels.some((label) => typeof label !== 'string' || label.length > 100)) {
      throw new BadRequestException({
        code: 'CUSTOM_SERVICE_LABEL_INVALID',
        message: 'customServiceLabels values must be text of at most 100 characters.',
      });
    }
    const details = await this.articlesRepository.findServiceDetails(ids);
    const invalidIds = ids.filter((id) => !details.get(id)?.isActive);
    if (invalidIds.length > 0) {
      throw new BadRequestException({
        code: 'SERVICE_IDS_INVALID',
        message: `Invalid or inactive service id(s): ${invalidIds.join(', ')}`,
      });
    }
    const missingCustomLabels = ids.filter((id) => details.get(id)?.isCustom && !customLabels?.[id]?.trim());
    if (missingCustomLabels.length > 0) {
      throw new BadRequestException({
        code: 'CUSTOM_SERVICE_LABEL_REQUIRED',
        message: `customServiceLabels required for custom service id(s): ${missingCustomLabels.join(', ')}`,
      });
    }
  }

  private async resolveServiceDetails(ids: string[]): Promise<Map<string, ServiceDetail>> {
    return this.articlesRepository.findServiceDetails(ids);
  }

  // Resolves service ids to their names, for use in a natural-language prompt.
  async resolveServiceNamesList(ids: string[]): Promise<string[]> {
    const map = await this.resolveServiceDetails(ids);
    return ids.map((id) => map.get(id)?.name).filter((name): name is string => Boolean(name));
  }

  private async resolveAuthors(ids: string[]): Promise<Map<string, AuthorInfo>> {
    return this.articlesRepository.findAuthorsInfo(ids);
  }
}

function assertWordCount(body: string): void {
  const wordCount = countArticleWords(body);
  if (wordCount < MIN_ARTICLE_WORDS || wordCount > MAX_ARTICLE_WORDS) {
    throw new BadRequestException({
      code: 'ARTICLE_WORD_COUNT_OUT_OF_RANGE',
      message: `Article body must be between ${MIN_ARTICLE_WORDS} and ${MAX_ARTICLE_WORDS} words (got ${wordCount}).`,
    });
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
  return Math.max(1, Math.round(countArticleWords(body) / 200));
}

function toDto(
  row: ArticleRow,
  serviceDetails: Map<string, ServiceDetail>,
  authors: Map<string, AuthorInfo>
): ArticleDto {
  return { ...toListDto(row, serviceDetails, authors), body: row.body };
}

function toListDto(
  row: ArticleListRow,
  serviceDetails: Map<string, ServiceDetail>,
  authors: Map<string, AuthorInfo>
): ArticleListItemDto {
  const services: ArticleService[] = row.service_ids
    .filter((id) => serviceDetails.has(id))
    .map((id) => {
      const d = serviceDetails.get(id)!;
      return { id, name: d.name, categoryId: d.categoryId, categoryName: d.categoryName };
    });
  const author = authors.get(row.author_id);

  return {
    id: row.id,
    slug: row.slug,
    authorId: row.author_id,
    authorName: author?.name ?? 'GrowXQ Member',
    authorSlug: author?.slug ?? null,
    authorPhotoUrl: author?.photoUrl ?? null,
    authorHeadline: author?.headline ?? null,
    authorFirmName: author?.firmName ?? null,
    status: row.status,
    title: row.title,
    excerpt: row.excerpt,
    aiSummary: row.ai_summary,
    creationMode: row.creation_mode,
    readTimeMinutes: row.read_time_minutes,
    coverImageUrl: row.cover_image_url,
    services,
    customServiceLabels: row.custom_service_labels ?? {},
    countries: row.countries,
    state: row.state,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
