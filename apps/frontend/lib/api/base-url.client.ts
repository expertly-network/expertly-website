import { getApiUrl } from '@/lib/env';

// Client Components — the runtime API_URL the root layout injected into the page (lib/env.ts).
export function getApiBaseUrlClient(): string {
  return getApiUrl();
}
