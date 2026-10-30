import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AccountStatus, AuthenticatedUser, MemberStatus, Role } from './types/auth.types';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];
const ACCOUNT_STATUSES: AccountStatus[] = ['active', 'suspended', 'deleted'];

// Supabase's asymmetric JWT signing keys (JWKS). Pinned so a token can never be verified with an
// algorithm the key wasn't meant for (alg confusion / `none`).
const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

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
  // Postgres role the token grants — 'authenticated' for a signed-in user ('anon' /
  // 'service_role' for the project's API keys, which are never a user session).
  role?: string;
  user_metadata?: { first_name?: string; last_name?: string };
  // Custom claims set by custom_access_token_hook (supabase/migrations/0003_functions.sql).
  app_role?: string;
  app_status?: string;
  app_member_status?: string | null;
}

export interface VerifiedToken {
  user: AuthenticatedUser;
  /**
   * The hook always emits app_status and app_member_status (null for non-members); a token
   * without them predates the hook. Then `user.status` / `user.memberStatus` are NOT known from
   * the token — SupabaseAuthGuard resolves them fresh from the database.
   */
  missingStatusClaims: boolean;
}

/** Verifies a Supabase access token and reports which status claims it actually carried. */
export async function verifySupabaseTokenClaims(token: string): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(token, getJwks(), {
    algorithms: ALLOWED_ALGORITHMS,
    audience: 'authenticated',
    issuer: `${(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')}/auth/v1`,
  });
  const claims = payload as unknown as SupabaseJwtPayload;
  if (claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Token is not a signed-in user session.');
  }

  const claimedRole = claims.app_role;
  const role: Role = VALID_ROLES.includes(claimedRole as Role) ? (claimedRole as Role) : 'client';

  const missingStatusClaims = claims.app_status === undefined || claims.app_member_status === undefined;

  // A missing claim is never read as active (see VerifiedToken); an unknown value is not active.
  const status: AccountStatus = ACCOUNT_STATUSES.includes(claims.app_status as AccountStatus)
    ? (claims.app_status as AccountStatus)
    : 'suspended';
  const memberStatus: MemberStatus =
    claims.app_member_status === 'active' || claims.app_member_status === 'deactivated'
      ? claims.app_member_status
      : claims.app_member_status === undefined && role === 'member'
        ? 'deactivated'
        : null;

  return {
    user: {
      id: claims.sub,
      email: claims.email,
      role,
      status,
      memberStatus,
      firstName: claims.user_metadata?.first_name ?? '',
      lastName: claims.user_metadata?.last_name ?? '',
    },
    missingStatusClaims,
  };
}

/**
 * Verifies a Supabase access token and returns the authenticated user it encodes. Claim-only (no
 * DB read): a token missing the status claims comes back as not active (status 'suspended', a
 * member as 'deactivated') — callers that must admit such tokens use verifySupabaseTokenClaims()
 * and resolve status fresh, as SupabaseAuthGuard does.
 */
export async function verifySupabaseToken(token: string): Promise<AuthenticatedUser> {
  return (await verifySupabaseTokenClaims(token)).user;
}
