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
