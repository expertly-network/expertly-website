import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PKCE code-exchange endpoint for the OAuth flow — exchanges the provider's `?code=` for a
// session and sets the session cookies.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnTo = searchParams.get('returnTo') ?? '/';
  const intent = searchParams.get('intent');

  // Derived from forwarded headers since the server's own bind address isn't the public host.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sends an already-activated member to their dashboard, everyone else to the application.
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
