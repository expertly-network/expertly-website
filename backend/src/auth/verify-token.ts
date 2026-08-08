import jwt from 'jsonwebtoken';
import type { AuthenticatedUser, Role } from './types/auth.types';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];

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
 * Verifies a Supabase access token's signature locally (HS256, the project's
 * JWT secret) — no network round-trip to Supabase Auth, no DB query. This is
 * the fast path used for nearly every request.
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
export function verifySupabaseToken(token: string, jwtSecret: string): AuthenticatedUser {
  const payload = jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
    audience: 'authenticated',
  }) as SupabaseJwtPayload;

  const claimedRole = payload.app_role;
  const role: Role = VALID_ROLES.includes(claimedRole as Role) ? (claimedRole as Role) : 'client';

  return {
    id: payload.sub,
    email: payload.email,
    role,
    firstName: payload.user_metadata?.first_name ?? '',
    lastName: payload.user_metadata?.last_name ?? '',
  };
}
