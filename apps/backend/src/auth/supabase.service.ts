import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';

const SUPABASE_REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class SupabaseService {
  // Service-role Supabase client. Bypasses RLS — never expose outside the backend.
  readonly db: SupabaseClient<Database>;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
    }

    this.db = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      // No request to Postgres/Storage may hang a request forever. Generous enough for a 15MB
      // Storage upload; any caller-supplied signal still applies too.
      global: {
        fetch: (input, init) => {
          const timeout = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
          return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
        },
      },
    });
  }
}
