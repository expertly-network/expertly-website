import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeReturnTo } from '@/lib/auth/return-to';
import { resolveSiteUrl } from '@/lib/env';

// PKCE code-exchange endpoint for the OAuth flow — exchanges the provider's `?code=` for a
// session and sets the session cookies.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const intent = searchParams.get('intent');

  // One of the configured public origins (NEXT_PUBLIC_SITE_URL) — the one this request arrived on,
  // so the session cookies just set on that host stay with the user. The Host / X-Forwarded-Host
  // headers only choose among those origins; anything else falls back to the canonical one, so a
  // client can't bounce a freshly signed-in user to a host it controls (open redirect). The
  // server's own bind address (request.url) isn't the public host behind the proxy either.
  const origin = resolveSiteUrl(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sends an already-activated member back to where they started, everyone else to the application.
      let destination: string;
      if (intent === 'member') {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: profile } = user
          ? await supabase.from('profiles').select('role').eq('id', user.id).single()
          : { data: null };
        destination = profile?.role === 'member' ? returnTo : '/apply';
      } else {
        destination = returnTo;
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  const failureMode = intent === 'member' ? '&mode=member' : '';
  return NextResponse.redirect(`${origin}/login?error=oauth_failed${failureMode}`);
}
