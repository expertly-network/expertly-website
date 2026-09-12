import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthenticatedUser, Role } from './types/auth.types';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];

// Cached JWKS client used to verify Supabase-issued token signatures.
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
  // Custom claim carrying the app's client/member/admin role.
  app_role?: string;
}

/** Verifies a Supabase access token and returns the authenticated user it encodes. */
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
