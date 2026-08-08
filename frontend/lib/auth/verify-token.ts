import jwt from 'jsonwebtoken';
import type { Profile, Role } from '@/lib/auth/types';

const VALID_ROLES: Role[] = ['client', 'member', 'admin'];

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
 * Verifies a Supabase access token's signature locally (HS256, the project's
 * JWT secret) — no round-trip to Supabase Auth. Mirrors
 * backend/src/auth/verify-token.ts; see CLAUDE.md for the full rationale
 * (fast path everywhere, DB re-check reserved for sensitive backend actions).
 *
 * `app_role` is only present once the Custom Access Token Hook is registered
 * in the Supabase dashboard; missing/unrecognized claims safely default to
 * 'client' — the lowest-privilege role (fails closed, not open).
 */
export function verifySupabaseToken(token: string, jwtSecret: string): Profile {
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
    first_name: payload.user_metadata?.first_name ?? '',
    last_name: payload.user_metadata?.last_name ?? '',
  };
}
