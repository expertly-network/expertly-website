import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request. Must write refreshed
 * cookies to *both* `request.cookies` (so the rest of the middleware chain sees
 * them) and a freshly-created `NextResponse` (so the browser receives them) —
 * writing to only one is the classic bug that silently logs users out after the
 * access token's ~1hr expiry.
 *
 * Uses `getUser()`, not `getSession()`: `getUser()` revalidates the token against
 * Supabase itself, while `getSession()` trusts whatever is in the cookie.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
