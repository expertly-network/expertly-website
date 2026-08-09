import { createClient } from '@/lib/supabase/server';
import { ApiError } from '@/lib/api/client';
import type { ApplicationDto } from '@shared/membership-application';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Server Component variant of getMyApplication — used for the /apply page's
 * pre-render gate (redirect to the status page if an application already
 * exists, before showing the wizard at all). Returns null on 404 (no
 * application yet) instead of throwing, since that's the expected/common
 * case here, not an error.
 */
export async function getMyApplicationServer(): Promise<ApplicationDto | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${API_URL}/v1/applications/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load application.', res.status);
  }

  return res.json();
}
