import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

/**
 * Shared by both the User and Member tabs — no special-casing needed. A
 * pre-provisioned member's first LinkedIn login auto-links to their existing
 * profiles row (role='member') via Supabase's default email-matching behavior; a
 * brand-new LinkedIn user gets role='client' via the same handle_new_user trigger
 * as email signup.
 */
export async function signInWithLinkedIn(returnTo: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
    },
  });

  return { error: error ? mapAuthError(error) : null };
}
