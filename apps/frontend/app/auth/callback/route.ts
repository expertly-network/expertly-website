import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// A brand-new Supabase auth user's created_at and last_sign_in_at are set in
// the same request and land within a couple seconds of each other; an
// existing account being signed into again has a last_sign_in_at from well
// after its original created_at. This is the standard way to tell "this
// OAuth login just created an account" apart from "this matched an existing
// one" — Supabase doesn't expose that as a direct flag. Gating LinkedIn
// signup on Terms/Privacy consent isn't in design/static_html at all — this
// app-level decision is documented in docs/auth.md, not derived from design.
const NEW_ACCOUNT_THRESHOLD_MS = 5000;

function isNewlyCreatedAccount(user: { created_at: string; last_sign_in_at?: string | null }): boolean {
  if (!user.last_sign_in_at) return true;
  const createdAt = new Date(user.created_at).getTime();
  const lastSignInAt = new Date(user.last_sign_in_at).getTime();
  return Math.abs(lastSignInAt - createdAt) < NEW_ACCOUNT_THRESHOLD_MS;
}

// PKCE code-exchange endpoint. Required by @supabase/ssr's OAuth flow — the
// provider redirects the browser back here with a `?code=`, and this route
// exchanges it for a session and sets the session cookies. (Separate from, and
// unrelated to, the backend REST API needing no custom /auth/oauth endpoint —
// that's about the NestJS API layer, not this Next.js SSR requirement.)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnTo = searchParams.get('returnTo') ?? '/';
  const intent = searchParams.get('intent');
  const consented = searchParams.get('consented') === '1';

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Member-tab LinkedIn flow: LinkedIn only verifies identity, it doesn't
      // make someone a member — membership is application-gated. Send an
      // already-activated member to their dashboard, and everyone else (brand
      // new signup, or an existing client who hasn't applied yet) to the
      // membership application instead of `returnTo`.
      let destination: string;
      if (intent === 'member') {
        const { data: profile } = user
          ? await supabase.from('profiles').select('role').eq('id', user.id).single()
          : { data: null };
        destination = profile?.role === 'member' ? '/dashboard' : '/apply';
      } else {
        destination = returnTo;
      }

      // A LinkedIn sign-in (not the explicit Sign Up view, which already
      // collected consent before ever reaching LinkedIn — `consented=1`)
      // that turns out to have created a brand-new account never got asked
      // to agree to the Terms/Privacy Policy, since Supabase creates the
      // account as an unavoidable side effect of the OAuth handshake itself
      // — there's no earlier point to ask. Route through a confirmation
      // step instead of silently landing them in the app. See docs/auth.md.
      if (!consented && user && isNewlyCreatedAccount(user)) {
        return NextResponse.redirect(
          `${origin}/auth/confirm-signup?destination=${encodeURIComponent(destination)}`
        );
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  const failureMode = intent === 'member' ? '&mode=member' : '';
  return NextResponse.redirect(`${origin}/login?error=oauth_failed${failureMode}`);
}
