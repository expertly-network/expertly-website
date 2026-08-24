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

/**
 * Client-side authenticated fetch — attaches the current Supabase session's
 * access token as a Bearer header. Every backend route requires this except
 * ones marked @Public() (which happily ignore an absent/invalid token since
 * they never check it).
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // A FormData body must NOT get an explicit Content-Type — fetch sets
  // multipart/form-data with the correct boundary itself only when the header
  // is left unset. Any other body (or none) uses JSON as before.
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${getApiBaseUrlClient()}/v1${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // NestJS's default error shape: { message: string | string[], error, statusCode }.
    // message is an array for class-validator failures — join for a readable string.
    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : (body?.message ?? `Request failed with status ${res.status}`);
    throw new ApiError(message, res.status);
  }

  // 204/empty responses have no body to parse.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
