import { createClient } from '@/lib/supabase/client';
import { getApiBaseUrlClient } from '@/lib/api/base-url.client';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Exact format RolesGuard throws on a role-rank rejection (apps/backend/src/auth/guards/
// roles.guard.ts). Deliberately narrow — not every 403 — because this is the one case a token
// refresh can actually fix: the session's `app_role` claim is stale (e.g. a client just promoted
// to member hasn't re-authenticated yet), and a freshly minted token would carry the correct role.
// Other 403s (AdminPermissionGuard's permission checks, the fresh-admin DB re-check) are always
// re-verified against the database directly regardless of what the token says, so refreshing never
// changes their outcome — retrying those would just waste a round trip.
const STALE_ROLE_PATTERN = /^Requires role: .+\. You are: .+\.$/;

function doFetch(path: string, options: RequestInit, accessToken: string | undefined): Promise<Response> {
  // FormData and bodyless requests must not get an explicit Content-Type.
  const isFormData = options.body instanceof FormData;
  return fetch(`${getApiBaseUrlClient()}/v1${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
}

// Attaches the current session's access token as a Bearer header. On a stale-role 403
// (STALE_ROLE_PATTERN), refreshes the session once and retries with the new token before giving
// up — self-heals a just-promoted client/member without requiring a manual sign-out/sign-in.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let res = await doFetch(path, options, session?.access_token);

  if (res.status === 403 && session) {
    const body = await res
      .clone()
      .json()
      .catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    if (typeof message === 'string' && STALE_ROLE_PATTERN.test(message)) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) {
          res = await doFetch(path, options, refreshed.session.access_token);
        }
      } catch {
        // Refreshing failed — fall through with the original 403 and surface that instead.
      }
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // message is an array for validation failures; join into a readable string.
    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : (body?.message ?? `Request failed with status ${res.status}`);
    throw new ApiError(message, res.status);
  }

  // 204/empty responses have no body to parse.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
