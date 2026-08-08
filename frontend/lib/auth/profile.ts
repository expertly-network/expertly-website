import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/auth/types';

/**
 * The "fresh" tier: always queries `profiles.role` directly from the DB,
 * bypassing the JWT claim entirely. Nav rendering and route gating use the
 * faster claims-based `getSessionUser()` (lib/auth/session-claims.ts) instead —
 * reserve this one for a future page that genuinely needs guaranteed-current
 * data (e.g. right before a sensitive/destructive action), mirroring how the
 * backend's RolesGuard re-checks the DB for admin routes specifically.
 *
 * Wrapped in React's `cache()` so multiple call sites in one request dedupe to
 * a single DB round-trip.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name, email')
    .eq('id', user.id)
    .single();

  return profile as Profile | null;
});
