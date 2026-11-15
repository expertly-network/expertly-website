import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';

// PostgREST caps a response at 1000 rows by default; page through so the country list stays
// complete as the member base grows.
const PAGE_SIZE = 1000;

@Injectable()
export class StatsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  /** The `country` of every active member (one entry per member). */
  async listActiveMemberCountries(): Promise<string[]> {
    const countries: string[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.supabase.db
        .from('member_profiles')
        .select('country')
        .eq('status', 'active')
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new InternalServerErrorException('Failed to load platform stats.');
      for (const row of data) countries.push(row.country);
      if (data.length < PAGE_SIZE) return countries;
    }
  }

  async countActiveCategories(): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    if (error) throw new InternalServerErrorException('Failed to load platform stats.');
    return count ?? 0;
  }

  async countConsultationRequests(): Promise<number> {
    const { count, error } = await this.supabase.db
      .from('consultation_requests')
      .select('id', { count: 'exact', head: true });
    if (error) throw new InternalServerErrorException('Failed to load platform stats.');
    return count ?? 0;
  }
}
