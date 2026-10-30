import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { ArticleCreationMode, ArticleStatus } from '@shared/article';
import { MAX_LIST_ROWS } from '../common/list-limits';
import { generateUniqueSlug, isSlugUniqueViolation, SlugTakenException } from '../common/slugify';

export type ArticleInsert = Database['public']['Tables']['articles']['Insert'];
export type ArticleUpdate = Database['public']['Tables']['articles']['Update'];

// Raw shape of a row selected from public.articles.
export interface ArticleRow {
  id: string;
  slug: string;
  author_id: string;
  status: ArticleStatus;
  title: string;
  body: string;
  excerpt: string;
  read_time_minutes: number;
  cover_image_url: string;
  service_ids: string[];
  custom_service_labels: Record<string, string>;
  countries: string[];
  state: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  creation_mode: ArticleCreationMode;
  ai_generation_id: string | null;
}

// List queries never need `body` (the bulk of each row, ~8KB per article) — leaving it out of the
// SELECT halves the transfer and the latency of the public list.
export type ArticleListRow = Omit<ArticleRow, 'body'>;

// The few article fields the admin AI-generations log shows next to a generation it produced.
export interface LinkedArticleRow {
  id: string;
  title: string;
  status: ArticleStatus;
  ai_generation_id: string;
}

const ARTICLE_COLUMNS = [
  'id',
  'slug',
  'author_id',
  'status',
  'title',
  'body',
  'excerpt',
  'read_time_minutes',
  'cover_image_url',
  'service_ids',
  'custom_service_labels',
  'countries',
  'state',
  'rejection_reason',
  'created_at',
  'updated_at',
  'ai_summary',
  'creation_mode',
  'ai_generation_id',
] as const;

const LIST_COLUMNS = ARTICLE_COLUMNS.filter((c) => c !== 'body');

// Public reads only show articles whose author is live: an inner join on the author's profile
// (filtered to status 'active', not deleted) drops a suspended/deleted author's articles in SQL,
// so paging and `total` stay exact. A deactivated member profile is excluded by id (see
// findDeactivatedMemberIds) — admin-authored articles have no member profile and stay visible.
const LIVE_AUTHOR_EMBED = 'live_author:profiles!articles_author_id_fkey!inner(status, deleted_at)';

type WithLiveAuthor<T> = T & { live_author?: unknown };

function stripLiveAuthor<T>(row: WithLiveAuthor<T>): T {
  const { live_author: _liveAuthor, ...rest } = row;
  return rest as T;
}

// Article slugs are kebab-case titles, so they can never collide with this UUID shape.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PublishedArticleFilters {
  authorId?: string;
  // Each matches an article carrying ANY of the given values (array overlap).
  serviceIds?: string[];
  countries?: string[];
  excludeId?: string;
}

export interface ServiceDetail {
  name: string;
  categoryId: string;
  categoryName: string;
  isCustom: boolean;
  isActive: boolean;
}

// A plain `string` rather than a literal, so supabase-js doesn't type-parse it: member_profiles.slug
// isn't in the generated Database type yet (see MemberProfileInsert in applications.repository.ts).
// Tighten back to a literal once `pnpm gen:types` has been re-run.
const AUTHOR_MEMBER_COLUMNS: string = 'profile_id, slug, photo_path, headline, firm_name';
interface AuthorMemberRow {
  profile_id: string;
  slug: string;
  photo_path: string | null;
  headline: string | null;
  firm_name: string | null;
}

export interface AuthorInfo {
  name: string;
  // Null when the author has no member profile (e.g. an admin-authored article).
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  firmName: string | null;
}

// Kebab-cases a title for use as the base of a slug.
@Injectable()
export class ArticlesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private articles() {
    return this.supabase.db.from('articles');
  }

  private services() {
    return this.supabase.db.from('services');
  }

  private categories() {
    return this.supabase.db.from('categories');
  }

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  async insert(row: ArticleInsert): Promise<ArticleRow> {
    const { data: inserted, error } = await this.articles().insert(row).select(ARTICLE_COLUMNS.join(', ')).single();

    // A slug race on insert: SlugTakenException so the service regenerates and retries.
    if (isSlugUniqueViolation(error))
      throw new SlugTakenException('ARTICLE_SLUG_TAKEN', 'Article slug already exists.');
    if (error || !inserted) throw new InternalServerErrorException('Failed to create article.');
    return inserted as unknown as ArticleRow;
  }

  // `total` is the full match count regardless of `range`, from the same query
  // (`count: 'exact'`), so it costs no extra round trip.
  async findPublished(
    filters: PublishedArticleFilters,
    range: { from: number; to: number }
  ): Promise<{ rows: ArticleListRow[]; total: number }> {
    const deactivatedIds = await this.findDeactivatedMemberIds();
    let query = this.articles()
      .select(`${LIST_COLUMNS.join(', ')}, ${LIVE_AUTHOR_EMBED}`, { count: 'exact' })
      .eq('status', 'published')
      .eq('live_author.status', 'active')
      .is('live_author.deleted_at', null)
      .order('created_at', { ascending: false })
      // Tiebreak so page boundaries are stable when two articles share a timestamp.
      .order('id', { ascending: true });

    if (filters.authorId) query = query.eq('author_id', filters.authorId);
    if (filters.serviceIds?.length) query = query.overlaps('service_ids', filters.serviceIds);
    if (filters.countries?.length) query = query.overlaps('countries', filters.countries);
    if (filters.excludeId) query = query.neq('id', filters.excludeId);
    if (deactivatedIds.length > 0) query = query.not('author_id', 'in', `(${deactivatedIds.join(',')})`);
    query = query.range(range.from, range.to);

    const { data, error, count } = await query;

    if (error) throw new InternalServerErrorException('Failed to load articles.');
    const rows = ((data ?? []) as unknown as WithLiveAuthor<ArticleListRow>[]).map(stripLiveAuthor);
    return { rows, total: count ?? rows.length };
  }

  async findPublishedPreview(idOrSlug: string): Promise<ArticleListRow | null> {
    const column = UUID_PATTERN.test(idOrSlug) ? 'id' : 'slug';
    const { data, error } = await this.articles()
      .select(`${LIST_COLUMNS.join(', ')}, ${LIVE_AUTHOR_EMBED}`)
      .eq(column, idOrSlug)
      .eq('status', 'published')
      .eq('live_author.status', 'active')
      .is('live_author.deleted_at', null)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load article.');
    if (!data) return null;
    const row = stripLiveAuthor(data as unknown as WithLiveAuthor<ArticleListRow>);
    return (await this.isAuthorListed(row.author_id)) ? row : null;
  }

  // Whether an author's published articles are publicly visible: account active and not deleted,
  // and — when they have a member profile — that profile not deactivated. For single-article
  // reads (the list query does the same filter in SQL).
  async isAuthorListed(authorId: string): Promise<boolean> {
    const [{ data: profile, error: profileError }, { data: member, error: memberError }] = await Promise.all([
      this.profiles().select('status, deleted_at').eq('id', authorId).maybeSingle(),
      this.memberProfiles().select('status').eq('profile_id', authorId).maybeSingle(),
    ]);
    if (profileError || memberError) throw new InternalServerErrorException('Failed to resolve article author.');
    if (!profile || profile.status !== 'active' || profile.deleted_at) return false;
    return !member || member.status !== 'deactivated';
  }

  // Deactivation is a rare admin action, so this list stays short enough to inline as a filter.
  private async findDeactivatedMemberIds(): Promise<string[]> {
    const { data, error } = await this.memberProfiles().select('profile_id').eq('status', 'deactivated');
    if (error) throw new InternalServerErrorException('Failed to load articles.');
    return (data ?? []).map((r) => r.profile_id as string);
  }

  async findByIdOrThrow(id: string): Promise<ArticleRow> {
    const { data, error } = await this.articles().select(ARTICLE_COLUMNS.join(', ')).eq('id', id).maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load article.');
    if (!data) throw new NotFoundException({ code: 'ARTICLE_NOT_FOUND', message: 'Article not found.' });
    return data as unknown as ArticleRow;
  }

  // Accepts either the UUID or the slug — public article URLs use the slug.
  async findByIdOrSlugOrThrow(idOrSlug: string): Promise<ArticleRow> {
    const column = UUID_PATTERN.test(idOrSlug) ? 'id' : 'slug';
    const { data, error } = await this.articles().select(ARTICLE_COLUMNS.join(', ')).eq(column, idOrSlug).maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load article.');
    if (!data) throw new NotFoundException({ code: 'ARTICLE_NOT_FOUND', message: 'Article not found.' });
    return data as unknown as ArticleRow;
  }

  async findAllByAuthor(authorId: string): Promise<ArticleListRow[]> {
    const { data, error } = await this.articles()
      .select(LIST_COLUMNS.join(', '))
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_ROWS);

    if (error) throw new InternalServerErrorException('Failed to load your articles.');
    return (data ?? []) as unknown as ArticleListRow[];
  }

  async updateById(id: string, patch: ArticleUpdate): Promise<ArticleRow> {
    const { data: updated, error } = await this.articles()
      .update(patch)
      .eq('id', id)
      .select(ARTICLE_COLUMNS.join(', '))
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update article.');
    return updated as unknown as ArticleRow;
  }

  // Null when the article is no longer pending review, or (with expectedUpdatedAt) has changed.
  async applyReview(id: string, patch: ArticleUpdate, expectedUpdatedAt?: string): Promise<ArticleRow | null> {
    let query = this.articles().update(patch).eq('id', id).eq('status', 'pending_review');
    if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
    const { data: updated, error } = await query.select(ARTICLE_COLUMNS.join(', ')).maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to review article.');
    return (updated as unknown as ArticleRow | null) ?? null;
  }

  async findForReview(status?: ArticleStatus): Promise<ArticleListRow[]> {
    const { data, error } = await this.articles()
      .select(LIST_COLUMNS.join(', '))
      .eq('status', status ?? 'pending_review')
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_ROWS);

    if (error) throw new InternalServerErrorException('Failed to load articles for review.');
    return (data ?? []) as unknown as ArticleListRow[];
  }

  // Articles saved from any of the given ai_draft_generations rows, for the admin AI-generations log.
  async findByAiGenerationIds(generationIds: string[]): Promise<LinkedArticleRow[]> {
    const uniqueIds = [...new Set(generationIds)];
    if (uniqueIds.length === 0) return [];
    const { data, error } = await this.articles()
      .select('id, title, status, ai_generation_id')
      .in('ai_generation_id', uniqueIds);
    if (error) throw new InternalServerErrorException('Failed to load linked articles.');
    return (data ?? []) as unknown as LinkedArticleRow[];
  }

  async deleteById(id: string): Promise<void> {
    const { error } = await this.articles().delete().eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to delete article.');
  }

  // Errors are not surfaced — a failed summary write shouldn't block the publish/approve response.
  async updateAiSummary(id: string, summary: string): Promise<void> {
    await this.articles().update({ ai_summary: summary }).eq('id', id);
  }

  async findServiceDetails(ids: string[]): Promise<Map<string, ServiceDetail>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const { data: services, error: servicesError } = await this.services()
      .select('id, name, category_id, is_custom, is_active')
      .in('id', uniqueIds);
    if (servicesError) throw new InternalServerErrorException('Failed to resolve services.');

    const categoryIds = [...new Set((services ?? []).map((s) => s.category_id as string))];
    const categoryNameById = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await this.categories()
        .select('id, name')
        .in('id', categoryIds);
      if (categoriesError) throw new InternalServerErrorException('Failed to resolve categories.');
      for (const c of categories ?? []) categoryNameById.set(c.id as string, c.name as string);
    }

    return new Map(
      (services ?? []).map((s) => [
        s.id as string,
        {
          name: s.name as string,
          categoryId: s.category_id as string,
          categoryName: categoryNameById.get(s.category_id as string) ?? 'Unknown',
          isCustom: s.is_custom as boolean,
          isActive: s.is_active as boolean,
        },
      ])
    );
  }

  // Resolves author name/slug/photo/headline/firm from profiles and member_profiles.
  async findAuthorsInfo(ids: string[]): Promise<Map<string, AuthorInfo>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const [{ data: profiles, error: profilesError }, { data: memberProfiles, error: memberError }] = await Promise.all([
      this.profiles().select('id, first_name, last_name, avatar_url').in('id', uniqueIds),
      this.memberProfiles().select(AUTHOR_MEMBER_COLUMNS).in('profile_id', uniqueIds),
    ]);

    if (profilesError || memberError) {
      throw new InternalServerErrorException('Failed to resolve article authors.');
    }

    const memberRows = (memberProfiles ?? []) as unknown as AuthorMemberRow[];
    const memberByProfileId = new Map(memberRows.map((m) => [m.profile_id, m]));
    return new Map(
      (profiles ?? []).map((p) => {
        const member = memberByProfileId.get(p.id as string);
        const photoPath = member?.photo_path ?? null;
        return [
          p.id as string,
          {
            name: `${p.first_name} ${p.last_name}`.trim(),
            slug: member?.slug ?? null,
            photoUrl: photoPath ? this.buildPhotoUrl(photoPath) : ((p.avatar_url as string | null) ?? null),
            headline: member?.headline ?? null,
            firmName: member?.firm_name ?? null,
          },
        ];
      })
    );
  }

  // photo_path holds either a bucket-relative path (real uploads, application-assets — public,
  // so this is a plain permanent URL, not signed) or a legacy/seed full external URL — pass those
  // through unchanged.
  private buildPhotoUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = this.supabase.db.storage.from('application-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async findUniqueSlug(title: string): Promise<string> {
    return generateUniqueSlug(this.supabase.db, 'articles', title, 'article');
  }
}
