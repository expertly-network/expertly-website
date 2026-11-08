import { extractBearerToken } from './guards/supabase-auth.guard';
import { verifySupabaseTokenClaims } from './verify-token';

/**
 * The caller's user id on a @Public() route, which SupabaseAuthGuard doesn't authenticate: null
 * when there's no bearer token or it doesn't verify. Verified locally (cached JWKS), no DB call.
 * Only for routes that behave slightly differently for a signed-in caller — never for access control.
 */
export async function optionalUserId(authorizationHeader?: string): Promise<string | null> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) return null;
  try {
    return (await verifySupabaseTokenClaims(token)).user.id;
  } catch {
    return null;
  }
}
