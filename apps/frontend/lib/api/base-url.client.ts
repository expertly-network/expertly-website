import { API_URL_GLOBAL, BUILD_TIME_API_URL } from '@/lib/api/base-url.shared';

// Client Components — the runtime API_URL the root layout injected into the page.
export function getApiBaseUrlClient(): string {
  if (typeof window === 'undefined') return BUILD_TIME_API_URL;
  const injected = (window as unknown as Record<string, unknown>)[API_URL_GLOBAL];
  return typeof injected === 'string' && injected ? injected : BUILD_TIME_API_URL;
}
