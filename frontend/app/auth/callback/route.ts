import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PKCE code-exchange endpoint. Required by @supabase/ssr's OAuth flow — the
// provider redirects the browser back here with a `?code=`, and this route
// exchanges it for a session and sets the session cookies. (Separate from, and
// unrelated to, the backend REST API needing no custom /auth/oauth endpoint —
// that's about the NestJS API layer, not this Next.js SSR requirement.)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const returnTo = searchParams.get('returnTo') ?? '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${returnTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
