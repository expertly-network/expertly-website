import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';

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
// Supabase's session cookie is `sb-<project-ref>-auth-token` (chunked as `.0`, `.1`, … when large).
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));
}

/**
 * `requestHeaders` are extra headers forwarded to the route (the CSP nonce — see middleware.ts);
 * they're re-applied whenever the response is rebuilt so a session refresh can't drop them.
 */
export async function updateSession(request: NextRequest, requestHeaders: Record<string, string> = {}) {
  const next = () => {
    // Copied after request.cookies.set(), so the route sees the refreshed session cookie too.
    const headers = new Headers(request.headers);
    for (const [name, value] of Object.entries(requestHeaders)) headers.set(name, value);
    return NextResponse.next({ request: { headers } });
  };

  let supabaseResponse = next();

  // A signed-out visitor has no session to refresh or verify — skip the Supabase client entirely.
  if (!hasSessionCookie(request)) {
    return { response: supabaseResponse, userId: null, role: null };
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = next();
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;
  // The Custom Access Token Hook's role claim (see docs/auth.md) — verified with the rest of the JWT.
  const appRole = data?.claims.app_role;
  const role = typeof appRole === 'string' ? appRole : null;

  return { response: supabaseResponse, userId, role };
}
