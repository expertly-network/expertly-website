import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  // Service-role client: bypasses RLS. Used only for the fresh `profiles.role`
  // re-check that RolesGuard performs on 🛡️ Admin routes (see roles.guard.ts) —
  // every other route trusts the JWT's claims (see verify-token.ts) without
  // touching the DB at all. Never expose this client or its key outside this
  // backend.
  readonly db: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
    }

    this.db = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
