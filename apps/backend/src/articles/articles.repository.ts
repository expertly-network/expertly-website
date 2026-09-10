import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { ArticleCreationMode, ArticleStatus } from '@shared/article';

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
  practice_area_ids: string[];
  countries: string[];
  state: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  creation_mode: ArticleCreationMode;
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
  'practice_area_ids',
  'countries',
  'state',
  'rejection_reason',
  'created_at',
  'updated_at',
  'ai_summary',
  'creation_mode',
] as const;

export interface AuthorInfo {
  name: string;
  photoUrl: string | null;
  headline: string | null;
  firmName: string | null;
}

// Kebab-cases a title for use as the base of a slug.
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'article';
}

@Injectable()
export class ArticlesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async insert(row: Record<string, unknown>): Promise<ArticleRow> {
    const { data: inserted, error } = await this.supabase.db
      .from('articles')
      .insert(row)
      .select(ARTICLE_COLUMNS.join(', '))
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create article.');
    return inserted as unknown as ArticleRow;
  }

  async findPublished(authorId?: string): Promise<ArticleRow[]> {
    let query = this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS.join(', '))
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (authorId) query = query.eq('author_id', authorId);

    const { data, error } = await query;

    if (error) throw new InternalServerErrorException('Failed to load articles.');
    return (data ?? []) as unknown as ArticleRow[];
  }

  async findAllByAuthor(authorId: string): Promise<ArticleRow[]> {
    const { data, error } = await this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS.join(', '))
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load your articles.');
    return (data ?? []) as unknown as ArticleRow[];
  }

  async findByIdOrThrow(id: string): Promise<ArticleRow> {
    const { data, error } = await this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load article.');
    if (!data) throw new NotFoundException('Article not found.');
    return data as unknown as ArticleRow;
  }

  async updateById(id: string, patch: Record<string, unknown>): Promise<ArticleRow> {
    const { data: updated, error } = await this.supabase.db
      .from('articles')
      .update(patch)
      .eq('id', id)
      .select(ARTICLE_COLUMNS.join(', '))
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update article.');
    return updated as unknown as ArticleRow;
  }

  async applyReview(id: string, patch: Record<string, unknown>): Promise<ArticleRow> {
    const { data: updated, error } = await this.supabase.db
      .from('articles')
      .update(patch)
      .eq('id', id)
      .select(ARTICLE_COLUMNS.join(', '))
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to review article.');
    return updated as unknown as ArticleRow;
  }

  async findForReview(status?: ArticleStatus): Promise<ArticleRow[]> {
    const { data, error } = await this.supabase.db
      .from('articles')
      .select(ARTICLE_COLUMNS.join(', '))
      .eq('status', status ?? 'pending_review')
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load articles for review.');
    return (data ?? []) as unknown as ArticleRow[];
  }

  async deleteById(id: string): Promise<void> {
    const { error } = await this.supabase.db.from('articles').delete().eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to delete article.');
  }

  // Errors are not surfaced — a failed summary write shouldn't block the publish/approve response.
  async updateAiSummary(id: string, summary: string): Promise<void> {
    await this.supabase.db.from('articles').update({ ai_summary: summary }).eq('id', id);
  }

  // Only ids that exist and are currently active.
  async findActivePracticeAreaIds(ids: string[]): Promise<Set<string>> {
    const { data, error } = await this.supabase.db
      .from('practice_areas')
      .select('id')
      .eq('is_active', true)
      .in('id', ids);

    if (error) throw new InternalServerErrorException('Failed to validate practice areas.');
    return new Set((data ?? []).map((p) => p.id as string));
  }

  // Resolves practice area names regardless of whether they're still active.
  async findPracticeAreaNames(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.supabase.db.from('practice_areas').select('id, name').in('id', uniqueIds);

    if (error) throw new InternalServerErrorException('Failed to resolve practice areas.');
    return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
  }

  // Resolves author name/photo/headline/firm from profiles and member_profiles.
  async findAuthorsInfo(ids: string[]): Promise<Map<string, AuthorInfo>> {
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

  async findUniqueSlug(title: string): Promise<string> {
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
