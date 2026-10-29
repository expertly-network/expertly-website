import { createClient } from '@/lib/supabase/client';
import { getApiBaseUrlClient } from '@/lib/api/base-url.client';
import { apiErrorFromResponse } from '@/lib/api/errors';

export { ApiError } from '@/lib/api/errors';

// RolesGuard's role-rank rejection (apps/backend/src/auth/guards/roles.guard.ts) — deliberately
// narrow, not every 403, because this is the one case a token refresh can actually fix: the
// session's `app_role` claim is stale (e.g. a client just promoted to member hasn't
// re-authenticated yet), and a freshly minted token would carry the correct role. Other 403s
// (permission checks, the fresh-admin DB re-check, a suspended account) are re-verified against the
// database regardless of what the token says, so refreshing never changes their outcome.
// MEMBER_DEACTIVATED is claim-based the same way (a just-reactivated member's token is stale).
const REFRESHABLE_403_CODES = ['ROLE_REQUIRED', 'MEMBER_DEACTIVATED'];

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

// Attaches the current session's access token as a Bearer header. On a stale-claim 403
// (REFRESHABLE_403_CODES), refreshes the session once and retries with the new token before giving
// up — self-heals a just-promoted client/member without requiring a manual sign-out/sign-in.
async function apiRequest(path: string, options: RequestInit): Promise<Response> {
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
    if (REFRESHABLE_403_CODES.includes(body?.code)) {
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

  if (!res.ok) throw await apiErrorFromResponse(res);

  return res;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiRequest(path, options);
  // 204/empty responses have no body to parse.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// The raw Response, for a non-JSON body (e.g. a CSV download). Same auth + error handling.
export function apiFetchResponse(path: string, options: RequestInit = {}): Promise<Response> {
  return apiRequest(path, options);
}

// For a paged list endpoint: the array body plus the total match count from `totalHeader`.
export async function apiFetchPage<T>(
  path: string,
  totalHeader: string,
  options: RequestInit = {}
): Promise<{ items: T[]; total: number }> {
  const res = await apiRequest(path, options);
  const items = (await res.json()) as T[];
  const total = Number(res.headers.get(totalHeader));
  return { items, total: Number.isFinite(total) && res.headers.has(totalHeader) ? total : items.length };
}
