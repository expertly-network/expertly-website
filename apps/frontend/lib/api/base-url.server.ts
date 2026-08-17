import { headers } from 'next/headers';
import { API_HOSTS, FALLBACK_API_URL } from '@/lib/api/base-url.shared';

// Server Components / server-side fetches — reads the incoming request's Host
// header. Only callable within a request scope (forces dynamic rendering,
// same as the no-store fetches that use it). Kept in its own file — any
// module that imports next/headers can't be part of a Client Component's
// bundle, even indirectly, so this must stay out of base-url.client.ts.
export function getApiBaseUrlServer(): string {
  const host = headers().get('host') ?? '';
  const hostname = host.split(':')[0];
  return API_HOSTS[hostname] ?? FALLBACK_API_URL;
}
