import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';
import type { Profile } from '@/lib/auth/types';

/**
 * Fast path: reads the session cookie (no network call — `getSession()` just
 * decodes what's stored) and verifies the JWT's signature locally, taking
 * `role`/name straight off its claims. Used for nav rendering, route gating,
 * and any page that doesn't need guaranteed-this-second-fresh data.
 *
 * This is NOT the right choice for anything sensitive/destructive on the
 * frontend (there isn't such a page yet) — those should re-fetch from the DB
 * the same way the backend's RolesGuard does for admin routes. Wrapped in
 * cache() so multiple call sites in one request (nav + page) dedupe to a
 * single verification.
 */
export const getSessionUser = cache(async (): Promise<Profile | null> => {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  try {
    return await verifySupabaseToken(session.access_token);
  } catch {
    return null;
  }
});
