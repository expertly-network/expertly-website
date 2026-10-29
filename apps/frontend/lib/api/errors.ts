// One error type for every NestJS API failure, client- or server-side. The backend's global
// exception filter always answers `{ statusCode, code, message }` (see docs/rest-api.md "Errors"),
// so UI code branches on `code` for specific copy rather than matching message text.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    /** Stable machine-readable error code from the API body, e.g. `CONSULTATION_PENDING_EXISTS`. */
    public readonly code?: string,
    /** Present on a 429: seconds to wait before retrying. */
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorBody {
  message?: unknown;
  code?: unknown;
  retryAfterSeconds?: unknown;
}

// Reads a failed response's body into an ApiError. `fallbackMessage` covers non-JSON bodies
// (a proxy's HTML error page, an empty 502).
export async function apiErrorFromResponse(res: Response, fallbackMessage?: string): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  // message is an array for validation failures; join into a readable string.
  const message = Array.isArray(body?.message)
    ? body.message.join(' ')
    : typeof body?.message === 'string'
      ? body.message
      : (fallbackMessage ?? `Request failed with status ${res.status}`);
  return new ApiError(
    message,
    res.status,
    typeof body?.code === 'string' ? body.code : undefined,
    typeof body?.retryAfterSeconds === 'number' ? body.retryAfterSeconds : undefined
  );
}
