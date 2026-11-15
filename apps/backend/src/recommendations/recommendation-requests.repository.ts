import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { RecommendationRequestStatus } from '@shared/recommendation-request';

const COLUMNS = ['id', 'requester_id', 'recipient_id', 'message', 'status', 'created_at', 'responded_at'] as const;
const SELECT = COLUMNS.join(', ');
const MAX_ROWS = 200;

export interface RecommendationRequestRow {
  id: string;
  requester_id: string;
  recipient_id: string;
  message: string | null;
  status: RecommendationRequestStatus;
  created_at: string;
  responded_at: string | null;
}

export interface PersonRow {
  profile_id: string;
  slug: string;
  photo_path: string | null;
  headline: string | null;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  work_email: string | null;
}

@Injectable()
export class RecommendationRequestsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private requests() {
    return this.supabase.db.from('recommendation_requests');
  }

  async insert(requesterId: string, recipientId: string, message: string | null): Promise<RecommendationRequestRow> {
    const { data, error } = await this.requests()
      .insert({ requester_id: requesterId, recipient_id: recipientId, message })
      .select(SELECT)
      .single();
    if (error) throw new InternalServerErrorException('Failed to create the recommendation request.');
    return data as unknown as RecommendationRequestRow;
  }

  async findById(id: string): Promise<RecommendationRequestRow | null> {
    const { data, error } = await this.requests().select(SELECT).eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load the recommendation request.');
    return data as unknown as RecommendationRequestRow | null;
  }

  async findPendingPair(requesterId: string, recipientId: string): Promise<RecommendationRequestRow | null> {
    const { data, error } = await this.requests()
      .select(SELECT)
      .eq('requester_id', requesterId)
      .eq('recipient_id', recipientId)
      .eq('status', 'pending')
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load the recommendation request.');
    return data as unknown as RecommendationRequestRow | null;
  }

  /** The most recent ignored/cancelled request for this pair — drives the re-ask cooldown. */
  async findLatestEndedPair(requesterId: string, recipientId: string): Promise<RecommendationRequestRow | null> {
    const { data, error } = await this.requests()
      .select(SELECT)
      .eq('requester_id', requesterId)
      .eq('recipient_id', recipientId)
      .in('status', ['ignored', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load the recommendation request.');
    return data as unknown as RecommendationRequestRow | null;
  }

  /** Requests the requester still has open: pending, plus ignored ones (they cannot tell the difference). */
  async countOpenByRequester(requesterId: string): Promise<number> {
    const { count, error } = await this.requests()
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', requesterId)
      .in('status', ['pending', 'ignored']);
    if (error) throw new InternalServerErrorException('Failed to count recommendation requests.');
    return count ?? 0;
  }

  async listPendingForRecipient(recipientId: string): Promise<RecommendationRequestRow[]> {
    const { data, error } = await this.requests()
      .select(SELECT)
      .eq('recipient_id', recipientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new InternalServerErrorException('Failed to load recommendation requests.');
    return data as unknown as RecommendationRequestRow[];
  }

  async listByRequester(requesterId: string): Promise<RecommendationRequestRow[]> {
    const { data, error } = await this.requests()
      .select(SELECT)
      .eq('requester_id', requesterId)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new InternalServerErrorException('Failed to load recommendation requests.');
    return data as unknown as RecommendationRequestRow[];
  }

  /** Moves a still-pending request to `status`. Null when it was no longer pending. */
  async transitionPending(id: string, status: RecommendationRequestStatus): Promise<RecommendationRequestRow | null> {
    const { data, error } = await this.requests()
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select(SELECT)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update the recommendation request.');
    return data as unknown as RecommendationRequestRow | null;
  }

  /** The recipient wrote the recommendation: close the open request that asked for it. */
  async fulfillPending(requesterId: string, recipientId: string): Promise<void> {
    const { error } = await this.requests()
      .update({ status: 'fulfilled', responded_at: new Date().toISOString() })
      .eq('requester_id', requesterId)
      .eq('recipient_id', recipientId)
      .eq('status', 'pending');
    if (error) throw new InternalServerErrorException('Failed to update the recommendation request.');
  }

  async findPeople(ids: string[]): Promise<Map<string, PersonRow>> {
    const map = new Map<string, PersonRow>();
    const unique = [...new Set(ids)];
    if (unique.length === 0) return map;
    const [members, profiles] = await Promise.all([
      this.supabase.db
        .from('member_profiles')
        .select('profile_id, slug, photo_path, headline, work_email')
        .in('profile_id', unique),
      this.supabase.db.from('profiles').select('id, first_name, last_name, avatar_url').in('id', unique),
    ]);
    if (members.error || profiles.error) throw new InternalServerErrorException('Failed to load members.');
    const profileById = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    for (const m of members.data ?? []) {
      const p = profileById.get(m.profile_id);
      if (!p) continue;
      map.set(m.profile_id, {
        profile_id: m.profile_id,
        slug: m.slug,
        photo_path: m.photo_path,
        headline: m.headline,
        work_email: m.work_email,
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url,
      });
    }
    return map;
  }

  async hasRecommendation(authorId: string, recipientId: string): Promise<boolean> {
    const { count, error } = await this.supabase.db
      .from('member_recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', authorId)
      .eq('recipient_id', recipientId);
    if (error) throw new InternalServerErrorException('Failed to check recommendations.');
    return (count ?? 0) > 0;
  }

  buildPhotoUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = this.supabase.db.storage.from('application-assets').getPublicUrl(path);
    return data.publicUrl;
  }
}
