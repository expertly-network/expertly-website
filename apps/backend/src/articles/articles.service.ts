import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { SupabaseService } from '../auth/supabase.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminArticleListItemDto,
  ArticleCreationMode,
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

const MIN_WORDS = 400;
const MAX_WORDS = 2000;
const EXCERPT_LENGTH = 200;

type ArticlesReviewMode = 'instant' | 'editorial';

// Word count / excerpt are derived from the sanitised body's plain text, not the raw HTML — so
// tags don't inflate the word count and the excerpt doesn't contain stray markup.
function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

// Raw shape of a row selected from public.articles. `creation_mode` now backs the AI-drafting
// write flow (POST /v1/articles/ai-draft + CreateArticleDto.creationMode) — selected/exposed
// below, no longer the dead column the old comment here described. `ai_summary` is populated by
// generateSummaryIfNeeded() the first time an article is published (see docs/rest-api.md),
// unrelated to creation_mode
interface ArticleRow {
  id: string;
  slug: string;
  author_id: string;
  status: ArticleStatus;
  title: string;
  body: string;
  excerpt: string;
  read_time_minutes: number;
  cover_image_url: string;
  practice_area_ids: string[];
  countries: string[];
  state: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  creation_mode: ArticleCreationMode;
}

const ARTICLE_COLUMNS =
  'id, slug, author_id, status, title, body, excerpt, read_time_minutes, cover_image_url, practice_area_ids, countries, state, rejection_reason, created_at, updated_at, ai_summary, creation_mode';

interface AuthorInfo {
  name: string;
  // `profiles.avatar_url` is used directly (not a private storage path needing a signed URL) —
  // same posture as MembersService.toListDto's `photoUrl`.
  photoUrl: string | null;
  // headline/firmName mirror MemberListItemDto's fields — the article card's "designation"
  // line (design/static_html/articles.html: `[title, firm].filter(Boolean).join(', ')`).
  headline: string | null;
  firmName: string | null;
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
    private readonly supabase: SupabaseService,
    private readonly ai: AiService
  ) { }

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
    const slug = await this.generateUniqueSlug(dto.title);

    const { data: inserted, error } = await this.supabase.db
      .from('articles')
      .insert({
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
      })
      .select(ARTICLE_COLUMNS)
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create article.');

    const row = inserted as ArticleRow;
    this.generateSummaryIfNeeded(row);
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthors([user.id]),
    ]);
    return toDto(row, practiceAreaNames, authors);
  }

  async listPublished(authorId?: string): Promise<ArticleListItemDto[]> {
    let query = this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (authorId) query = query.eq('author_id', authorId);

    const { data, error } = await query;

    if (error) throw new InternalServerErrorException('Failed to load articles.');
    return this.toListDtos((data ?? []) as ArticleRow[]);
  }

  async listMine(user: AuthenticatedUser): Promise<ArticleListItemDto[]> {
    const { data, error } = await this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS)
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load your articles.');
    const rows = (data ?? []) as ArticleRow[];
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(rows.flatMap((r) => r.practice_area_ids)),
      this.resolveAuthors([user.id]),
    ]);
    return rows.map((row) => omitBody(toDto(row, practiceAreaNames, authors)));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ArticleDto> {
    const row = await this.getRowOrThrow(id);

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
    const existing = await this.getRowOrThrow(id);
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

    const { data: updated, error } = await this.supabase.db
      .from('articles')
      .update(patch)
      .eq('id', id)
      .select(ARTICLE_COLUMNS)
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update article.');

    const row = updated as ArticleRow;
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
    const { data, error } = await this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS)
      .eq('status', status ?? 'pending_review')
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load articles for review.');
    const rows = (data ?? []) as ArticleRow[];
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
    const existing = await this.getRowOrThrow(id);
    if (existing.status !== 'pending_review') {
      throw new BadRequestException('Only an article pending review can be approved or rejected.');
    }
    if (dto.status === 'rejected' && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required.');
    }

    const { data: updated, error } = await this.supabase.db
      .from('articles')
      .update({
        status: dto.status,
        rejection_reason: dto.status === 'rejected' ? dto.rejectionReason!.trim() : null,
      })
      .eq('id', id)
      .select(ARTICLE_COLUMNS)
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to review article.');

    const row = updated as ArticleRow;
    this.generateSummaryIfNeeded(row);
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthors([row.author_id]),
    ]);
    return toDto(row, practiceAreaNames, authors);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.getRowOrThrow(id);
    this.assertOwnerOrAdmin(existing, user);

    const { error } = await this.supabase.db.from('articles').delete().eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to delete article.');
  }

  private async toListDtos(rows: ArticleRow[]): Promise<ArticleListItemDto[]> {
    const [practiceAreaNames, authors] = await Promise.all([
      this.resolvePracticeAreaNames(rows.flatMap((r) => r.practice_area_ids)),
      this.resolveAuthors(rows.map((r) => r.author_id)),
    ]);
    return rows.map((row) => omitBody(toDto(row, practiceAreaNames, authors)));
  }

  private async getRowOrThrow(id: string): Promise<ArticleRow> {
    const { data, error } = await this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load article.');
    if (!data) throw new NotFoundException('Article not found.');
    return data as ArticleRow;
  }

  // Fires the first time an article becomes 'published' (ai_summary still null) — never on a
  // later edit to an already-published article, and never awaited by the caller: the publish/
  // approve response must return immediately regardless of whether the LLM call succeeds. Errors
  // are logged and swallowed here, same graceful-degrade posture as AiService's other callers.
  private generateSummaryIfNeeded(row: ArticleRow): void {
    if (row.status !== 'published' || row.ai_summary !== null) return;

    void this.ai
      .summarizeArticle(row.title, row.body)
      .then((summary) => this.supabase.db.from('articles').update({ ai_summary: summary }).eq('id', row.id))
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

  // Write path: only ids that exist AND are currently active are accepted —
  // same load-bearing check as ApplicationsService.create()'s practice-area
  // validation (no FK, so this is the only thing enforcing referential
  // integrity on write).
  private async assertActivePracticeAreaIds(ids: string[]): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('practice_areas')
      .select('id')
      .eq('is_active', true)
      .in('id', ids);

    if (error) throw new InternalServerErrorException('Failed to validate practice areas.');

    const validIds = new Set((data ?? []).map((p) => p.id as string));
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

  // Read path: deliberately NOT filtered by is_active — an already-created
  // article should keep showing the real name of a practice area even if
  // it's since been deactivated, unlike the write-path check above.
  private async resolvePracticeAreaNames(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.supabase.db
      .from('practice_areas')
      .select('id, name')
      .in('id', uniqueIds);

    if (error) throw new InternalServerErrorException('Failed to resolve practice areas.');
    return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
  }

  // Every article author is a `member` — their real photo lives on `member_profiles.photo_url`
  // (set from their application, see MembersService's identical fallback), not
  // `profiles.avatar_url` (a separate, not-yet-built self-service-avatar column that's null for
  // every seeded/real member today). Two queries rather than a join: supabase-js's embedded-
  // resource syntax needs a declared FK relationship for this pair that doesn't exist here (see
  // `member_profiles.profile_id`'s own comment in the migration), so a plain `.in()` + in-memory
  // merge is simpler than fighting the query builder for one nullable column.
  private async resolveAuthors(ids: string[]): Promise<Map<string, AuthorInfo>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const [{ data: profiles, error: profilesError }, { data: memberProfiles, error: memberError }] =
      await Promise.all([
        this.supabase.db.from('profiles').select('id, first_name, last_name, avatar_url').in('id', uniqueIds),
        this.supabase.db
          .from('member_profiles')
          .select('profile_id, photo_url, headline, firm_name')
          .in('profile_id', uniqueIds),
      ]);

    if (profilesError || memberError) {
      throw new InternalServerErrorException('Failed to resolve article authors.');
    }

    const memberByProfileId = new Map((memberProfiles ?? []).map((m) => [m.profile_id as string, m]));
    return new Map(
      (profiles ?? []).map((p) => {
        const member = memberByProfileId.get(p.id as string);
        return [
          p.id as string,
          {
            name: `${p.first_name} ${p.last_name}`.trim(),
            photoUrl: (member?.photo_url as string | null) ?? (p.avatar_url as string | null) ?? null,
            headline: (member?.headline as string | null) ?? null,
            firmName: (member?.firm_name as string | null) ?? null,
          },
        ];
      })
    );
  }

  // Slugs are always generated server-side (root CLAUDE.md's non-negotiable rule) — kebab-case
  // the title, then disambiguate against the table's real unique constraint by appending
  // `-2`, `-3`, ... rather than trusting an in-memory check for a race-free guarantee.
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    for (let suffix = 2; ; suffix++) {
      const { data, error } = await this.supabase.db
        .from('articles')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();

      if (error) throw new InternalServerErrorException('Failed to generate article slug.');
      if (!data) return candidate;
      candidate = `${base}-${suffix}`;
    }
  }
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'article';
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
