import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Component / Route Handler / Server Action client.
 *
 * `cookies()` is synchronous on Next.js 14 (this repo's pinned version) — do not
 * `await` it; that's a Next 15-ism.
 *
 * Server Components render read-only and cannot write cookies, so `setAll` below
 * silently no-ops there. That's fine: `middleware.ts` is what actually persists
 * refreshed session cookies. Route Handlers and Server Actions using this same
 * client *can* write cookies (e.g. the OAuth callback route).
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component render — no-op.
          }
        },
      },
    }
  );
}
