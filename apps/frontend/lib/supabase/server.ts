import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

// Server Component / Route Handler / Server Action client. Server Components render read-only
// and cannot write cookies, so setAll below silently no-ops there — middleware.ts is what
// actually persists refreshed session cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL, SUPABASE_ANON_KEY,
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
