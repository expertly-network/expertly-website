import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Profile, Role } from '@/lib/auth/types';
import { getSupabaseUrl } from '@/lib/env';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];

// Cached JWKS client used to verify Supabase-issued token signatures.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${getSupabaseUrl()}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  // Email signup writes first_name/last_name (continue-with-email.ts); LinkedIn/Google OAuth
  // populate the OIDC-standard given_name/family_name instead — same dual-key read as
  // handle_new_user() in supabase/migrations/0003_functions.sql, so every signup path works.
  user_metadata?: { first_name?: string; last_name?: string; given_name?: string; family_name?: string };
  // Postgres role the token grants — 'authenticated' for a signed-in user ('anon' / 'service_role'
  // for the project's API keys, which must never be accepted as a user session).
  role?: string;
  // Custom claim carrying the app's client/member/admin role.
  app_role?: string;
}

// Verifies a Supabase access token and returns the profile it encodes.
export async function verifySupabaseToken(token: string): Promise<Profile> {
  // Same checks as the backend (apps/backend/src/auth/verify-token.ts): signature, expiry,
  // audience, and that this project's Auth server issued it. Algorithms are pinned to the
  // asymmetric ones Supabase's signing keys use, so a key/alg mix-up can't be exploited.
  const { payload } = await jwtVerify(token, getJwks(), {
    algorithms: ['ES256', 'RS256'],
    audience: 'authenticated',
    issuer: `${getSupabaseUrl()}/auth/v1`,
  });
  const claims = payload as unknown as SupabaseJwtPayload;
  if (claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Token is not a signed-in user session.');
  }

  const claimedRole = claims.app_role;
  const role: Role = VALID_ROLES.includes(claimedRole as Role) ? (claimedRole as Role) : 'client';

  return {
    id: claims.sub,
    email: claims.email,
    role,
    first_name: claims.user_metadata?.first_name ?? claims.user_metadata?.given_name ?? '',
    last_name: claims.user_metadata?.last_name ?? claims.user_metadata?.family_name ?? '',
  };
}
