import type { ConsentPolicyUrlDto } from '@shared/consent-policy';
import { getApiBaseUrlServer } from '@/lib/api/base-url.server';
import { apiErrorFromResponse } from '@/lib/api/errors';

// Always fetched fresh — the signed URL has a short server-side expiry, so a cached response
// would hand back a dead link.
export async function getConsentPolicyUrlServer(slug: string): Promise<ConsentPolicyUrlDto | null> {
  const res = await fetch(`${await getApiBaseUrlServer()}/v1/consent-policies/${slug}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw await apiErrorFromResponse(res, 'This document could not be loaded.');
  return (await res.json()) as ConsentPolicyUrlDto;
}
