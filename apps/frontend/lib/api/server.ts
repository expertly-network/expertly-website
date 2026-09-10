import { createClient } from '@/lib/supabase/server';
import { ApiError } from '@/lib/api/client';
import { getApiBaseUrlServer } from '@/lib/api/base-url.server';
import type { AdminApplicationListItemDto, ApplicationDto } from '@shared/membership-application';
import type { MemberDto, MemberListItemDto, MemberProfileEditDto } from '@shared/member';
import type { PracticeAreaDto } from '@shared/practice-area';
import type { AdminArticleListItemDto, ArticleDto, ArticleListItemDto } from '@shared/article';
import type { EventDto } from '@shared/event';

// Returns the caller's current application, or null if none exists.
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

// Returns applications for the admin review queue.
export async function getAdminApplicationsServer(status?: string): Promise<AdminApplicationListItemDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${getApiBaseUrlServer()}/v1/admin/applications${qs}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load applications.', res.status);
  }

  return res.json();
}

// Returns the member directory list for the given query string.
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

// Returns a member's full profile, or null if signed out or not found.
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

// Returns the caller's own pending profile edit requests.
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

// Returns the list of active practice areas.
export async function getPracticeAreasServer(): Promise<PracticeAreaDto[]> {
  const res = await fetch(`${getApiBaseUrlServer()}/v1/practice-areas`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load practice areas.', res.status);
  }
  return res.json();
}

// Returns published articles, optionally filtered by author.
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

// Returns the caller's own articles regardless of status.
export async function getMyArticlesServer(): Promise<ArticleListItemDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`${getApiBaseUrlServer()}/v1/articles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load your articles.', res.status);
  }
  return res.json();
}

// Returns articles for the admin review queue.
export async function getAdminArticlesServer(status?: string): Promise<AdminArticleListItemDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${getApiBaseUrlServer()}/v1/admin/articles${qs}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load articles for review.', res.status);
  }

  return res.json();
}

// Returns a single article's full detail, or null if signed out or not found.
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

// Returns events, upcoming-only by default.
export async function getEventsServer(params: { upcoming?: boolean } = {}): Promise<EventDto[]> {
  const qs = params.upcoming === false ? '?upcoming=false' : '';
  const res = await fetch(`${getApiBaseUrlServer()}/v1/events${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load events.', res.status);
  }
  return res.json();
}

// Returns every event for the admin list, regardless of status.
export async function getAdminEventsServer(): Promise<EventDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`${getApiBaseUrlServer()}/v1/admin/events`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load events.', res.status);
  }

  return res.json();
}

// Returns a single event for the admin edit page, or null if not found.
export async function getAdminEventServer(id: string): Promise<EventDto | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${getApiBaseUrlServer()}/v1/admin/events/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load event.', res.status);
  }

  return res.json();
}
