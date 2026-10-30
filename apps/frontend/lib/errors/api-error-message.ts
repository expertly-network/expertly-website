import { ApiError } from '@/lib/api/errors';

/**
 * The user-facing message for a failed API call. Branches on the API's stable `code` (see
 * docs/rest-api.md "Errors"), never on status alone or on message text:
 *
 * 1. `byCode[err.code]` when the call site has specific copy for that code;
 * 2. shared copy for the auth / rate-limit codes any protected route can return;
 * 3. the backend's own message for other 4xx (written to be shown to the user);
 * 4. `fallback` for a 5xx, a network failure, or anything that isn't an ApiError — a server error's
 *    message is never shown.
 */
export function apiErrorMessage(
  err: unknown,
  fallback: string,
  byCode: Readonly<Partial<Record<string, string>>> = {}
): string {
  if (!(err instanceof ApiError)) return fallback;
  const specific = err.code ? byCode[err.code] : undefined;
  if (specific) return specific;
  if (err.statusCode >= 500) return fallback;
  switch (err.code) {
    case 'SESSION_MISSING':
    case 'SESSION_INVALID':
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please sign in again.';
    case 'ACCOUNT_SUSPENDED':
      return 'Your account is suspended. Contact GrowXQ support if you think this is a mistake.';
    case 'MEMBER_DEACTIVATED':
      return 'Your member profile is deactivated, so this action isn’t available.';
    case 'RATE_LIMITED':
      return err.retryAfterSeconds
        ? `Too many requests. Please wait ${err.retryAfterSeconds} seconds and try again.`
        : 'Too many requests. Please wait a moment and try again.';
    default:
      return err.message || fallback;
  }
}
