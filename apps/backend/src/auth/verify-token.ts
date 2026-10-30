import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AccountStatus, AuthenticatedUser, MemberStatus, Role } from './types/auth.types';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];
const ACCOUNT_STATUSES: AccountStatus[] = ['active', 'suspended', 'deleted'];

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
  // Custom claims set by custom_access_token_hook (supabase/migrations/0003_functions.sql).
  app_role?: string;
  app_status?: string;
  app_member_status?: string | null;
}

/** Verifies a Supabase access token and returns the authenticated user it encodes. */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser> {
  const { payload } = await jwtVerify(token, getJwks(), {
    audience: 'authenticated',
    issuer: `${(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')}/auth/v1`,
  });
  const claims = payload as unknown as SupabaseJwtPayload;

  const claimedRole = claims.app_role;
  const role: Role = VALID_ROLES.includes(claimedRole as Role) ? (claimedRole as Role) : 'client';

  // A token minted before the hook emitted app_status has no claim — treat it as active rather
  // than locking every user out until their next refresh. An unknown value is not active.
  const status: AccountStatus =
    claims.app_status === undefined
      ? 'active'
      : ACCOUNT_STATUSES.includes(claims.app_status as AccountStatus)
        ? (claims.app_status as AccountStatus)
        : 'suspended';
  const memberStatus: MemberStatus =
    claims.app_member_status === 'active' || claims.app_member_status === 'deactivated'
      ? claims.app_member_status
      : null;

  return {
    id: claims.sub,
    email: claims.email,
    role,
    status,
    memberStatus,
    firstName: claims.user_metadata?.first_name ?? '',
    lastName: claims.user_metadata?.last_name ?? '',
  };
}
