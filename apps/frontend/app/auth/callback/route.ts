import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PKCE code-exchange endpoint. Required by @supabase/ssr's OAuth flow — the
// provider redirects the browser back here with a `?code=`, and this route
// exchanges it for a session and sets the session cookies. (Separate from, and
// unrelated to, the backend REST API needing no custom /auth/oauth endpoint —
// that's about the NestJS API layer, not this Next.js SSR requirement.)
//
// No consent handling here — middleware.ts's consent gate catches any
// unconsented session on whatever page this redirects to next, regardless of
// whether this OAuth login just created a brand-new account or matched an
// existing one. See docs/auth.md.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnTo = searchParams.get('returnTo') ?? '/';
  const intent = searchParams.get('intent');

  // Self-hosted behind Traefik: request.url reflects the Next.js server's own
  // bind address (0.0.0.0:3000), not the public host, so the origin must be
  // derived from the forwarded headers instead — same pattern as
  // lib/api/base-url.server.ts.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Member-tab LinkedIn flow: LinkedIn only verifies identity, it doesn't
      // make someone a member — membership is application-gated. Send an
      // already-activated member to their dashboard, and everyone else (brand
      // new signup, or an existing client who hasn't applied yet) to the
      // membership application instead of `returnTo`.
      let destination: string;
      if (intent === 'member') {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: profile } = user
          ? await supabase.from('profiles').select('role').eq('id', user.id).single()
          : { data: null };
        destination = profile?.role === 'member' ? '/dashboard' : '/apply';
      } else {
        destination = returnTo;
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  const failureMode = intent === 'member' ? '&mode=member' : '';
  return NextResponse.redirect(`${origin}/login?error=oauth_failed${failureMode}`);
}
