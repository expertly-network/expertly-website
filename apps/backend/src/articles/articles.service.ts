import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  ArticleDto,
  ArticleListItemDto,
  ArticlePracticeArea,
} from '@shared/article';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

const MIN_WORDS = 800;
const MAX_WORDS = 2000;
const EXCERPT_LENGTH = 200;

// Raw shape of a row selected from public.articles.
interface ArticleRow {
  id: string;
  author_id: string;
  status: 'draft' | 'published';
  title: string;
  body: string;
  excerpt: string;
  read_time_minutes: number;
  cover_image_url: string;
  practice_area_ids: string[];
  country: string;
  state: string | null;
  created_at: string;
  updated_at: string;
}

const ARTICLE_COLUMNS =
  'id, author_id, status, title, body, excerpt, read_time_minutes, cover_image_url, practice_area_ids, country, state, created_at, updated_at';

@Injectable()
export class ArticlesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(user: AuthenticatedUser, dto: CreateArticleDto): Promise<ArticleDto> {
    assertWordCount(dto.body);
    await this.assertActivePracticeAreaIds(dto.practiceAreaIds);

    const { data: inserted, error } = await this.supabase.db
      .from('articles')
      .insert({
        author_id: user.id,
        status: 'published',
        title: dto.title,
        body: dto.body,
        excerpt: deriveExcerpt(dto.body),
        read_time_minutes: deriveReadTimeMinutes(dto.body),
        cover_image_url: dto.coverImageUrl,
        practice_area_ids: dto.practiceAreaIds,
        country: dto.country,
        state: dto.state ?? null,
      })
      .select(ARTICLE_COLUMNS)
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create article.');

    const row = inserted as ArticleRow;
    const [practiceAreaNames, authorNames] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      Promise.resolve(new Map([[user.id, `${user.firstName} ${user.lastName}`.trim()]])),
    ]);
    return toDto(row, practiceAreaNames, authorNames);
  }

  async listPublished(): Promise<ArticleListItemDto[]> {
    const { data, error } = await this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

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
    const practiceAreaNames = await this.resolvePracticeAreaNames(
      rows.flatMap((r) => r.practice_area_ids)
    );
    const authorNames = new Map([[user.id, `${user.firstName} ${user.lastName}`.trim()]]);
    return rows.map((row) => omitBody(toDto(row, practiceAreaNames, authorNames)));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ArticleDto> {
    const row = await this.getRowOrThrow(id);

    // A draft is only visible to its own author or an admin — 404, not 403,
    // so a non-owner can't distinguish "doesn't exist" from "exists but
    // isn't published yet."
    if (row.status === 'draft' && row.author_id !== user.id && user.role !== 'admin') {
      throw new NotFoundException('Article not found.');
    }

    const [practiceAreaNames, authorNames] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthorNames([row.author_id]),
    ]);
    return toDto(row, practiceAreaNames, authorNames);
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateArticleDto): Promise<ArticleDto> {
    const existing = await this.getRowOrThrow(id);
    this.assertOwnerOrAdmin(existing, user);

    if (dto.body !== undefined) assertWordCount(dto.body);
    if (dto.practiceAreaIds !== undefined) {
      await this.assertActivePracticeAreaIds(dto.practiceAreaIds);
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.body !== undefined) {
      patch.body = dto.body;
      patch.excerpt = deriveExcerpt(dto.body);
      patch.read_time_minutes = deriveReadTimeMinutes(dto.body);
    }
    if (dto.coverImageUrl !== undefined) patch.cover_image_url = dto.coverImageUrl;
    if (dto.practiceAreaIds !== undefined) patch.practice_area_ids = dto.practiceAreaIds;
    if (dto.country !== undefined) patch.country = dto.country;
    if (dto.state !== undefined) patch.state = dto.state;
    if (dto.status !== undefined) patch.status = dto.status;

    const { data: updated, error } = await this.supabase.db
      .from('articles')
      .update(patch)
      .eq('id', id)
      .select(ARTICLE_COLUMNS)
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update article.');

    const row = updated as ArticleRow;
    const [practiceAreaNames, authorNames] = await Promise.all([
      this.resolvePracticeAreaNames(row.practice_area_ids),
      this.resolveAuthorNames([row.author_id]),
    ]);
    return toDto(row, practiceAreaNames, authorNames);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.getRowOrThrow(id);
    this.assertOwnerOrAdmin(existing, user);

    const { error } = await this.supabase.db.from('articles').delete().eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to delete article.');
  }

  private async toListDtos(rows: ArticleRow[]): Promise<ArticleListItemDto[]> {
    const [practiceAreaNames, authorNames] = await Promise.all([
      this.resolvePracticeAreaNames(rows.flatMap((r) => r.practice_area_ids)),
      this.resolveAuthorNames(rows.map((r) => r.author_id)),
    ]);
    return rows.map((row) => omitBody(toDto(row, practiceAreaNames, authorNames)));
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

  private async resolveAuthorNames(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.supabase.db
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', uniqueIds);

    if (error) throw new InternalServerErrorException('Failed to resolve article authors.');
    return new Map(
      (data ?? []).map((p) => [p.id as string, `${p.first_name} ${p.last_name}`.trim()])
    );
  }
}

function assertWordCount(body: string): void {
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
    throw new BadRequestException(
      `Article body must be between ${MIN_WORDS} and ${MAX_WORDS} words (got ${wordCount}).`
    );
  }
}

function deriveExcerpt(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= EXCERPT_LENGTH) return trimmed;
  const truncated = trimmed.slice(0, EXCERPT_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : EXCERPT_LENGTH)}…`;
}

function deriveReadTimeMinutes(body: string): number {
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

function omitBody(dto: ArticleDto): ArticleListItemDto {
  const { body: _body, ...rest } = dto;
  return rest;
}

function toDto(
  row: ArticleRow,
  practiceAreaNames: Map<string, string>,
  authorNames: Map<string, string>
): ArticleDto {
  const practiceAreas: ArticlePracticeArea[] = row.practice_area_ids
    .filter((id) => practiceAreaNames.has(id))
    .map((id) => ({ id, name: practiceAreaNames.get(id)! }));

  return {
    id: row.id,
    authorId: row.author_id,
    authorName: authorNames.get(row.author_id) ?? 'Expertly Member',
    status: row.status,
    title: row.title,
    body: row.body,
    excerpt: row.excerpt,
    readTimeMinutes: row.read_time_minutes,
    coverImageUrl: row.cover_image_url,
    practiceAreas,
    country: row.country,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
