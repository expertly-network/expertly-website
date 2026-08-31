import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

/**
 * Shared by both the User and Member tabs. `intent` records which tab
 * initiated the flow and is read back in app/auth/callback/route.ts: a
 * 'member' intent triggers the post-login "are they actually a member yet"
 * check (→ /dashboard if so, → /apply if not), while 'user' just returns to
 * `returnTo` like the email flow. A pre-provisioned member's first LinkedIn
 * login auto-links to their existing profiles row (role='member') via
 * Supabase's default email-matching behavior; a brand-new LinkedIn user gets
 * role='client' via the same handle_new_user trigger as email signup.
 *
 * No consent param here — middleware.ts's consent gate catches any
 * unconsented session on the very next request regardless of how the
 * account was created, so this flow doesn't need to know or care whether it
 * just created a new account. See docs/auth.md.
 */
export async function signInWithLinkedIn(
  returnTo: string,
  intent: 'user' | 'member'
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}&intent=${intent}`,
    },
  });

  return { error: error ? mapAuthError(error) : null };
}
