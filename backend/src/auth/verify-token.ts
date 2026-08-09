import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthenticatedUser, Role } from './types/auth.types';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];

// createRemoteJWKSet caches the fetched public keys in-process (handles
// rotation internally) — this is still a "no network call per request"
// design, just verifying against the project's real public key material
// instead of a shared secret. See the comment on verifySupabaseToken for why
// this replaced a jsonwebtoken/HS256 approach.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL env var.');
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  user_metadata?: { first_name?: string; last_name?: string };
  // Our custom claim, set by the custom_access_token_hook function (see
  // supabase/migrations/0001_profiles_and_auth.sql) — NOT the same as
  // Supabase's own built-in `role` claim, which is always "authenticated" for
  // any logged-in user (that's the Postgres role for RLS, unrelated to our
  // app's client/member/admin business role). Reading the wrong one here
  // would make every user look like they had role "authenticated".
  app_role?: string;
}

/**
 * Verifies a Supabase access token's signature against the project's JWKS
 * (public keys, fetched once and cached — no per-request network call to
 * Supabase Auth, no DB query). This is the fast path used for nearly every
 * request.
 *
 * Originally implemented against a shared HS256 secret (SUPABASE_JWT_SECRET)
 * — discovered wrong the first time this was tested against a real project:
 * Supabase's modern default is asymmetric signing (this project uses ES256),
 * which a shared-secret check can never verify regardless of which secret
 * value is configured. JWKS verification works with whatever algorithm the
 * project actually uses, since it validates against the real public key.
 *
 * `app_role` is only present once the Custom Access Token Hook is registered
 * in the Supabase dashboard (see CLAUDE.md); until then this safely defaults
 * to 'client' — the lowest-privilege role, i.e. fails closed, not open.
 *
 * Deliberately NOT the source of truth for 🛡️ Admin authorization by itself —
 * RolesGuard re-checks admin against the DB directly (see roles.guard.ts) since
 * this claim can be up to ~1hr stale (however long the access token has left
 * before its next refresh).
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser> {
  const { payload } = await jwtVerify(token, getJwks(), { audience: 'authenticated' });
  const claims = payload as unknown as SupabaseJwtPayload;

  const claimedRole = claims.app_role;
  const role: Role = VALID_ROLES.includes(claimedRole as Role) ? (claimedRole as Role) : 'client';

  return {
    id: claims.sub,
    email: claims.email,
    role,
    firstName: claims.user_metadata?.first_name ?? '',
    lastName: claims.user_metadata?.last_name ?? '',
  };
}
