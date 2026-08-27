import { createClient } from '@/lib/supabase/server';
import { ApiError } from '@/lib/api/client';
import { getApiBaseUrlServer } from '@/lib/api/base-url.server';
import type { ApplicationDto } from '@shared/membership-application';
import type { MemberDto, MemberListItemDto, MemberProfileEditDto } from '@shared/member';
import type { PracticeAreaDto } from '@shared/practice-area';
import type { ArticleDto, ArticleListItemDto } from '@shared/article';
import type { EventDto } from '@shared/event';

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

  const res = await fetch(`${getApiBaseUrlServer()}/v1/applications/me`, {
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

/**
 * Server Component variant for the /members directory's initial page. Public
 * endpoint — no auth header needed. `queryString` is the already-built
 * `?q=...&sort=...` string (see lib/members/search-params.ts, Task 3) so this
 * function has no filter-shape knowledge of its own, same division of
 * responsibility as the client-side getMembers().
 */
export async function getMembersServer(queryString: string): Promise<MemberListItemDto[]> {
  const res = await fetch(`${getApiBaseUrlServer()}/v1/members${queryString}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load members.', res.status);
  }

  return res.json();
}

/**
 * Server Component variant for /members/[id]'s full detail fetch. Returns
 * null on no-session or 404 — the page decides what null means in each case
 * (no session → auth wall, 404 → notFound()), mirroring getMyApplicationServer's
 * "null is the expected case, not an error" convention.
 */
export async function getMemberServer(id: string): Promise<MemberDto | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${getApiBaseUrlServer()}/v1/members/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load member profile.', res.status);
  }

  return res.json();
}

/**
 * Owner's own edit requests, for section pending-badge state. Only ever
 * called when the page has already established the viewer owns this
 * profile — an empty array on no-session is a safe default, not a real path.
 */
export async function getMyMemberEditsServer(id: string): Promise<MemberProfileEditDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`${getApiBaseUrlServer()}/v1/members/${id}/edits`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) return [];
  return res.json();
}

/**
 * Server-safe variant of lib/api/practice-areas.ts's getPracticeAreas() —
 * see the note above the imports for why the client one can't be called
 * from a Server Component. Public endpoint, no session needed.
 */
export async function getPracticeAreasServer(): Promise<PracticeAreaDto[]> {
  const res = await fetch(`${getApiBaseUrlServer()}/v1/practice-areas`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load practice areas.', res.status);
  }
  return res.json();
}

/**
 * Server Component variant of lib/api/articles.ts's getArticles() — public
 * endpoint (published articles only), no session needed. First caller is the
 * homepage's Latest Articles section.
 */
export async function getArticlesServer(
  params: { authorId?: string } = {}
): Promise<ArticleListItemDto[]> {
  const search = new URLSearchParams();
  if (params.authorId) search.set('authorId', params.authorId);
  const qs = search.toString();
  const res = await fetch(`${getApiBaseUrlServer()}/v1/articles${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load articles.', res.status);
  }
  return res.json();
}

/**
 * Server Component variant for /articles/[id]'s full detail fetch (body included). Mirrors
 * getMemberServer's convention exactly: null on no-session or 404, since reading a full
 * article requires being signed in (any role) — a deliberate product decision, see
 * docs/database-erd.md's Articles "Design decisions" note — not something this function
 * decides, just relays.
 */
export async function getArticleServer(id: string): Promise<ArticleDto | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${getApiBaseUrlServer()}/v1/articles/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load article.', res.status);
  }

  return res.json();
}

/**
 * Server Component variant — public endpoint, no session needed. Default (upcoming: true)
 * is the homepage's Upcoming Events section's original behaviour; the standalone /events page
 * passes upcoming: false for the full past+future set.
 */
export async function getEventsServer(params: { upcoming?: boolean } = {}): Promise<EventDto[]> {
  const qs = params.upcoming === false ? '?upcoming=false' : '';
  const res = await fetch(`${getApiBaseUrlServer()}/v1/events${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load events.', res.status);
  }
  return res.json();
}
