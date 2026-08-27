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
 * `consented` (default false): set true only when the caller already
 * collected explicit Terms/Privacy consent *before* this call (the User
 * tab's explicit "Sign up" view, which — unlike a plain "Sign in" click —
 * unambiguously means "create an account", so consent can be asked upfront).
 * The callback route skips its own new-account confirmation step when this
 * is true, so a genuinely new signup isn't asked to consent twice.
 */
export async function signInWithLinkedIn(
  returnTo: string,
  intent: 'user' | 'member',
  consented = false,
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}&intent=${intent}&consented=${consented ? '1' : '0'}`,
    },
  });

  return { error: error ? mapAuthError(error) : null };
}
