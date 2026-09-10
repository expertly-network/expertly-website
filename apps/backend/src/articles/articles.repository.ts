import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { ArticleCreationMode, ArticleStatus } from '@shared/article';

// Raw shape of a row selected from public.articles. `creation_mode` now backs the AI-drafting
// write flow (POST /v1/articles/ai-draft + CreateArticleDto.creationMode) — selected/exposed
// below, no longer the dead column the old comment here described. `ai_summary` is populated by
// ArticlesService.generateSummaryIfNeeded() the first time an article is published (see
// docs/rest-api.md), unrelated to creation_mode.
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
  // `profiles.avatar_url` is used directly (not a private storage path needing a signed URL) —
  // same posture as MembersRepository's `photoUrl`.
  photoUrl: string | null;
  // headline/firmName mirror MemberListItemDto's fields — the article card's "designation"
  // line (design/static_html/articles.html: `[title, firm].filter(Boolean).join(', ')`).
  headline: string | null;
  firmName: string | null;
}

// Slugs are always generated server-side (root CLAUDE.md's non-negotiable rule) — kebab-case the
// title, then disambiguate against the table's real unique constraint by appending `-2`, `-3`, ...
// Deliberately not sharing common/slugify.ts's generateUniqueSlug (pre-existing duplication, not
// something this layering pass changes — see the design spec's "explicitly out of scope").
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

  // Same shape as updateById — kept separate because it's a distinct intent (editorial decision)
  // with its own error message, matching what review() threw before this moved.
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

  // Fire-and-forget from ArticlesService.generateSummaryIfNeeded — deliberately doesn't check
  // `error` here, matching the original inline call's behavior: a failed ai_summary write is
  // swallowed the same way an AiService failure is (see that method's comment), not surfaced to
  // the publish/approve caller.
  async updateAiSummary(id: string, summary: string): Promise<void> {
    await this.supabase.db.from('articles').update({ ai_summary: summary }).eq('id', id);
  }

  // Write path: only ids that exist AND are currently active are accepted — same load-bearing
  // check as ApplicationsRepository's practice-area validation (no FK, so this is the only thing
  // enforcing referential integrity on write).
  async findActivePracticeAreaIds(ids: string[]): Promise<Set<string>> {
    const { data, error } = await this.supabase.db
      .from('practice_areas')
      .select('id')
      .eq('is_active', true)
      .in('id', ids);

    if (error) throw new InternalServerErrorException('Failed to validate practice areas.');
    return new Set((data ?? []).map((p) => p.id as string));
  }

  // Read path: deliberately NOT filtered by is_active — an already-created article should keep
  // showing the real name of a practice area even if it's since been deactivated, unlike the
  // write-path check above.
  async findPracticeAreaNames(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await this.supabase.db.from('practice_areas').select('id, name').in('id', uniqueIds);

    if (error) throw new InternalServerErrorException('Failed to resolve practice areas.');
    return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
  }

  // Every article author is a `member` — their real photo lives on `member_profiles.photo_url`
  // (set from their application, see MembersRepository's identical fallback), not
  // `profiles.avatar_url` (a separate, not-yet-built self-service-avatar column that's null for
  // every seeded/real member today). Two queries rather than a join: supabase-js's embedded-
  // resource syntax needs a declared FK relationship for this pair that doesn't exist here (see
  // `member_profiles.profile_id`'s own comment in the migration), so a plain `.in()` + in-memory
  // merge is simpler than fighting the query builder for one nullable column.
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
