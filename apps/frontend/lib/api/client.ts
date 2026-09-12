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

// Attaches the current session's access token as a Bearer header.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // FormData and bodyless requests must not get an explicit Content-Type.
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${getApiBaseUrlClient()}/v1${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });

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
