import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';

const RECOMMENDATION_COLUMNS = ['id', 'author_id', 'recipient_id', 'body', 'is_hidden', 'created_at'] as const;

export interface RecommendationRow {
  id: string;
  author_id: string;
  recipient_id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
}

export interface MemberStatusRow {
  profile_id: string;
  status: 'active' | 'deactivated';
}

export interface AuthorSummaryRow {
  profile_id: string;
  slug: string;
  photo_path: string | null;
  first_name: string;
  last_name: string;
  initials: string | null;
  avatar_url: string | null;
}

@Injectable()
export class RecommendationsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private recommendations() {
    return this.supabase.db.from('member_recommendations');
  }

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  async findMemberStatus(profileId: string): Promise<MemberStatusRow | null> {
    const { data, error } = await this.memberProfiles().select('profile_id, status').eq('profile_id', profileId).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load member.');
    return (data as MemberStatusRow | null) ?? null;
  }

  async insert(authorId: string, recipientId: string, body: string): Promise<RecommendationRow> {
    const { data, error } = await this.recommendations()
      .insert({ author_id: authorId, recipient_id: recipientId, body })
      .select(RECOMMENDATION_COLUMNS.join(', '))
      .single();
    if (error?.code === '23505') {
      throw new ConflictException({
        code: 'RECOMMENDATION_ALREADY_EXISTS',
        message: 'You have already recommended this member.',
      });
    }
    if (error || !data) throw new InternalServerErrorException('Failed to save recommendation.');
    return data as unknown as RecommendationRow;
  }

  // Newest first. `includeHidden` false filters out hidden ones at the query.
  async findByRecipient(recipientId: string, includeHidden: boolean): Promise<RecommendationRow[]> {
    let query = this.recommendations().select(RECOMMENDATION_COLUMNS.join(', ')).eq('recipient_id', recipientId);
    if (!includeHidden) query = query.eq('is_hidden', false);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load recommendations.');
    return (data ?? []) as unknown as RecommendationRow[];
  }

  async findById(id: string): Promise<RecommendationRow> {
    const { data, error } = await this.recommendations()
      .select(RECOMMENDATION_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load recommendation.');
    if (!data) throw new NotFoundException('Recommendation not found.');
    return data as unknown as RecommendationRow;
  }

  async setHidden(id: string, isHidden: boolean): Promise<RecommendationRow> {
    const { data, error } = await this.recommendations()
      .update({ is_hidden: isHidden, hidden_at: isHidden ? new Date().toISOString() : null })
      .eq('id', id)
      .select(RECOMMENDATION_COLUMNS.join(', '))
      .single();
    if (error || !data) throw new InternalServerErrorException('Failed to update recommendation.');
    return data as unknown as RecommendationRow;
  }

  async findAuthorSummaries(authorIds: string[]): Promise<Map<string, AuthorSummaryRow>> {
    const map = new Map<string, AuthorSummaryRow>();
    const ids = [...new Set(authorIds)];
    if (ids.length === 0) return map;

    const [{ data: members, error: membersError }, { data: profiles, error: profilesError }] = await Promise.all([
      this.memberProfiles().select('profile_id, slug, photo_path').in('profile_id', ids),
      this.profiles().select('id, first_name, last_name, initials, avatar_url').in('id', ids),
    ]);
    if (membersError || profilesError) throw new InternalServerErrorException('Failed to load recommendation authors.');

    const profileById = new Map(
      (profiles ?? []).map((p) => [p.id as string, p as unknown as Omit<AuthorSummaryRow, 'profile_id' | 'slug' | 'photo_path'> & { id: string }])
    );
    for (const m of (members ?? []) as unknown as { profile_id: string; slug: string; photo_path: string | null }[]) {
      const p = profileById.get(m.profile_id);
      if (!p) continue;
      map.set(m.profile_id, {
        profile_id: m.profile_id,
        slug: m.slug,
        photo_path: m.photo_path,
        first_name: p.first_name,
        last_name: p.last_name,
        initials: p.initials,
        avatar_url: p.avatar_url,
      });
    }
    return map;
  }

  // Same convention as MembersRepository.buildPhotoUrl: bucket-relative path or external URL.
  buildPhotoUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = this.supabase.db.storage.from('application-assets').getPublicUrl(path);
    return data.publicUrl;
  }
}
