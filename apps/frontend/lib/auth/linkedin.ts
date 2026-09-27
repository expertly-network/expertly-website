import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

// Starts the LinkedIn OAuth flow; `intent` is read back by the callback route to decide the
// post-login destination.
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

// Links a LinkedIn identity to the currently signed-in (already-authenticated) account, rather
// than starting a new sign-in — used by the application flow to require a real LinkedIn OAuth
// connection from applicants who originally signed up with email/password. Requires "Manual
// linking" to be enabled under Supabase Dashboard → Authentication → Settings.
export async function linkLinkedInIdentity(returnTo: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.auth.linkIdentity({
    provider: 'linkedin_oidc',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
    },
  });

  return { error: error ? mapAuthError(error) : null };
}

// Whether the current session already has a LinkedIn identity linked (via original signup or a
// prior linkLinkedInIdentity() call).
export async function hasLinkedInIdentity(): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) return false;
  return data.identities.some((i) => i.provider === 'linkedin_oidc');
}
