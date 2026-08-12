import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Profile, Role } from '@/lib/auth/types';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];

// createRemoteJWKSet caches the fetched public keys in-process (handles
// rotation internally) — still a "no network call per request" design, just
// verifying against the project's real public key material instead of a
// shared secret. See the comment on verifySupabaseToken for why this
// replaced a jsonwebtoken/HS256 approach.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL env var.');
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  user_metadata?: { first_name?: string; last_name?: string };
  // Custom claim from custom_access_token_hook (supabase/migrations/) — NOT
  // Supabase's own built-in `role` claim, which is always "authenticated" for
  // any logged-in user and unrelated to our client/member/admin business role.
  app_role?: string;
}

/**
 * Verifies a Supabase access token's signature against the project's JWKS
 * (public keys, fetched once and cached — no round-trip to Supabase Auth).
 * Mirrors apps/backend/src/auth/verify-token.ts; see CLAUDE.md for the full
 * rationale (fast path everywhere, DB re-check reserved for sensitive
 * backend actions).
 *
 * Originally implemented against a shared HS256 secret — discovered wrong
 * the first time this was tested against a real project: Supabase's modern
 * default is asymmetric signing (this project uses ES256), which a
 * shared-secret check can never verify. JWKS verification works with
 * whatever algorithm the project actually uses.
 *
 * `app_role` is only present once the Custom Access Token Hook is registered
 * in the Supabase dashboard; missing/unrecognized claims safely default to
 * 'client' — the lowest-privilege role (fails closed, not open).
 */
export async function verifySupabaseToken(token: string): Promise<Profile> {
  const { payload } = await jwtVerify(token, getJwks(), { audience: 'authenticated' });
  const claims = payload as unknown as SupabaseJwtPayload;

  const claimedRole = claims.app_role;
  const role: Role = VALID_ROLES.includes(claimedRole as Role) ? (claimedRole as Role) : 'client';

  return {
    id: claims.sub,
    email: claims.email,
    role,
    first_name: claims.user_metadata?.first_name ?? '',
    last_name: claims.user_metadata?.last_name ?? '',
  };
}
