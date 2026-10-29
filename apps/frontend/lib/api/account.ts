import { apiFetch } from '@/lib/api/client';
import type { MyContactResponse } from '@shared/account';

// Not available from the fast-path session read (getSessionUser()) — the Supabase JWT's claims
// don't carry phone, so this is a real backend round-trip. Used to prefill the consultation
// request form; call it lazily (e.g. only once a form that needs it actually opens), not on
// every page load.
export function getMyContact(): Promise<MyContactResponse> {
  return apiFetch<MyContactResponse>('/me/contact');
}
