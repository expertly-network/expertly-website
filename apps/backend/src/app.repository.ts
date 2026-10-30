import { Injectable } from '@nestjs/common';
import { SupabaseService } from './auth/supabase.service';

const READINESS_TIMEOUT_MS = 3_000;

@Injectable()
export class AppRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  // Cheapest round trip that proves PostgREST + Postgres answer with the service key: a HEAD
  // count-less select of one id. False on any error or after READINESS_TIMEOUT_MS.
  async ping(): Promise<boolean> {
    try {
      const { error } = await this.profiles()
        .select('id', { head: true })
        .limit(1)
        .abortSignal(AbortSignal.timeout(READINESS_TIMEOUT_MS));
      return !error;
    } catch {
      return false;
    }
  }
}
