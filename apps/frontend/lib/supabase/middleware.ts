import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request. Must write refreshed
 * cookies to *both* `request.cookies` (so the rest of the middleware chain sees
 * them) and a freshly-created `NextResponse` (so the browser receives them) —
 * writing to only one is the classic bug that silently logs users out after the
 * access token's ~1hr expiry.
 *
 * Uses `getClaims()`, not `getSession()`: `getSession()` trusts whatever is in the cookie, while
 * `getClaims()` refreshes an expired session and then verifies the JWT signature locally against
 * the project's (cached) JWKS — the same check the backend makes, with no Auth-server round trip
 * per navigation (`getUser()` would make one on every matched request).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;

  return { response: supabaseResponse, userId };
}
