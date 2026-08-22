import { API_HOSTS, FALLBACK_API_URL } from '@/lib/api/base-url.shared';

// Client Components — reads the browser's own hostname.
export function getApiBaseUrlClient(): string {
  if (typeof window === 'undefined') return FALLBACK_API_URL;
  return API_HOSTS[window.location.hostname] ?? FALLBACK_API_URL;
}
