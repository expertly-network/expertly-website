import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { apiErrorFromResponse } from '@/lib/api/errors';
import { getApiBaseUrlServer } from '@/lib/api/base-url.server';
import { ARTICLES_TOTAL_COUNT_HEADER, buildArticlesQueryString } from '@/lib/api/articles-query';
import type { AdminApplicationListItemDto, ApplicationDto } from '@shared/membership-application';
import type {
  AdminMemberEditsDetailDto,
  MemberDto,
  MemberEditStatusFilter,
  MemberListItemDto,
  MemberProfileEditDto,
  MyMemberProfileDto,
} from '@shared/member';
import type { CategoryDto } from '@shared/category';
import type {
  AdminAiGenerationDetailDto,
  AdminAiGenerationListItemDto,
  AdminArticleListItemDto,
  AiGenerationStatus,
  ArticleDto,
  ArticleListItemDto,
  ListArticlesQuery,
} from '@shared/article';
import type { EventCalendarResponse, EventDto, ListEventsQuery } from '@shared/event';
import { buildEventsQueryString, EVENTS_TOTAL_COUNT_HEADER } from '@/lib/api/events-query';
import type { ConsultationRequestDto } from '@shared/consultation-request';

// Public, viewer-independent lists (no Authorization header) are cached in Next's data cache for
// this long — each one costs several sequential Supabase round trips on the backend, and they were
// re-fetched on every navigation. Trade-off: a new/edited article, event or member can take up to a
// minute to show up in these lists (there's no on-publish revalidation hook yet).
const PUBLIC_LIST_REVALIDATE_SECONDS = 60;

// Bearer token for the current request's session, or null when signed out. Reads the cookie
// session (getSession) — the backend verifies the JWT itself, so this needs no extra round trip.
// cache()d so a page making several API calls reads the cookie session once.
export const sessionToken = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});

interface ServerGetOptions<E> {
  /** Returned without calling the API when the route needs a session and there isn't one. */
  signedOut: E;
  /** Statuses that mean "nothing to show" rather than an error; they return `signedOut` too. */
  emptyOn?: readonly number[];
  /** Message used when the error body has none. */
  errorMessage: string;
}

// Authenticated, per-viewer GET — never cached.
export async function authedGet<T, E>(path: string, options: ServerGetOptions<E>): Promise<T | E> {
  const token = await sessionToken();
  if (!token) return options.signedOut;

  const res = await fetch(`${await getApiBaseUrlServer()}/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (options.emptyOn?.includes(res.status)) return options.signedOut;
  if (!res.ok) throw await apiErrorFromResponse(res, options.errorMessage);
  return (await res.json()) as T;
}

// Public, viewer-independent GET — cached for PUBLIC_LIST_REVALIDATE_SECONDS. A 404 resolves to
// null so single-item callers can render "not found"; any other failure throws.
async function publicGet(path: string, errorMessage: string): Promise<Response | null> {
  const res = await fetch(`${await getApiBaseUrlServer()}/v1${path}`, {
    next: { revalidate: PUBLIC_LIST_REVALIDATE_SECONDS },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await apiErrorFromResponse(res, errorMessage);
  return res;
}

// publicGet for a list endpoint: a 404 (never expected) is an empty list, not a crash.
async function publicList<T>(path: string, errorMessage: string): Promise<T[]> {
  const res = await publicGet(path, errorMessage);
  return res ? ((await res.json()) as T[]) : [];
}

// A list whose content depends on who's asking (e.g. resources: locked vs unlocked codes/URLs).
// Signed in: sent with the viewer's token and never cached. Signed out: every anonymous visitor
// gets the same response, so it's cached like the other public lists. A 404 is an empty list.
export async function viewerDependentList<T>(path: string, errorMessage: string): Promise<T[]> {
  const token = await sessionToken();
  if (!token) return publicList<T>(path, errorMessage);
  return authedGet<T[], T[]>(path, { signedOut: [], emptyOn: [404], errorMessage });
}

// Returns the caller's current application, or null if none exists.
export function getMyApplicationServer(): Promise<ApplicationDto | null> {
  return authedGet<ApplicationDto, null>('/applications/me', {
    signedOut: null,
    emptyOn: [404],
    errorMessage: 'Failed to load application.',
  });
}

// Returns applications for the admin review queue.
export function getAdminApplicationsServer(status?: string): Promise<AdminApplicationListItemDto[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return authedGet<AdminApplicationListItemDto[], AdminApplicationListItemDto[]>(`/admin/applications${qs}`, {
    signedOut: [],
    errorMessage: 'Failed to load applications.',
  });
}

// Returns full detail for the admin review page, or null if not found.
export function getAdminApplicationServer(id: string): Promise<ApplicationDto | null> {
  return authedGet<ApplicationDto, null>(`/admin/applications/${encodeURIComponent(id)}`, {
    signedOut: null,
    emptyOn: [400, 404],
    errorMessage: 'Failed to load application.',
  });
}

// Returns the caller's own sent consultation requests.
export function getMyConsultationsServer(): Promise<ConsultationRequestDto[]> {
  return authedGet<ConsultationRequestDto[], ConsultationRequestDto[]>('/consultations/mine', {
    signedOut: [],
    errorMessage: 'Failed to load your consultation requests.',
  });
}

// Returns consultation requests received by the caller (member role only — the backend 403s otherwise).
export function getReceivedConsultationsServer(): Promise<ConsultationRequestDto[]> {
  return authedGet<ConsultationRequestDto[], ConsultationRequestDto[]>('/consultations/received', {
    signedOut: [],
    errorMessage: 'Failed to load consultation requests.',
  });
}

// Every consultation request regardless of requester or member — admin oversight queue.
export function getAdminConsultationsServer(): Promise<ConsultationRequestDto[]> {
  return authedGet<ConsultationRequestDto[], ConsultationRequestDto[]>('/admin/consultations', {
    signedOut: [],
    errorMessage: 'Failed to load consultation requests.',
  });
}

// Returns the member directory list for the given query string.
export function getMembersServer(queryString: string): Promise<MemberListItemDto[]> {
  return publicList<MemberListItemDto>(`/members${queryString}`, 'Failed to load members.');
}

const MEMBERS_TOTAL_COUNT_HEADER = 'X-Total-Count';

// One directory page plus the total match count (the X-Total-Count header), for the page bar.
export async function getMembersPageServer(
  queryString: string
): Promise<{ items: MemberListItemDto[]; total: number }> {
  const res = await publicGet(`/members${queryString}`, 'Failed to load members.');
  if (!res) return { items: [], total: 0 };
  const items = (await res.json()) as MemberListItemDto[];
  const total = Number(res.headers.get(MEMBERS_TOTAL_COUNT_HEADER) ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

// Returns a member's full profile by slug, or null if signed out or not found. cache()d per request:
// generateMetadata, the page, and the article author sidebar all ask for the same profile.
export const getMemberServer = cache(
  (slug: string): Promise<MemberDto | null> =>
    authedGet<MemberDto, null>(`/members/${encodeURIComponent(slug)}`, {
      signedOut: null,
      emptyOn: [404],
      errorMessage: 'Failed to load member profile.',
    })
);

// The signed-in member's own profile handle, or null when there's no session / no member profile.
export function getMyMemberProfileServer(): Promise<MyMemberProfileDto | null> {
  return authedGet<MyMemberProfileDto, null>('/members/me/profile', {
    signedOut: null,
    emptyOn: [403, 404],
    errorMessage: 'Failed to load your profile.',
  });
}

// Returns the caller's own pending profile edit requests. Best-effort: the profile page renders
// without the "pending edits" badges rather than failing when this one call errors.
export async function getMyMemberEditsServer(id: string): Promise<MemberProfileEditDto[]> {
  try {
    return await authedGet<MemberProfileEditDto[], MemberProfileEditDto[]>(`/members/${encodeURIComponent(id)}/edits`, {
      signedOut: [],
      errorMessage: 'Failed to load your profile edits.',
    });
  } catch {
    return [];
  }
}

// Returns the active category→service taxonomy tree.
export function getCategoriesServer(): Promise<CategoryDto[]> {
  return publicList<CategoryDto>('/categories', 'Failed to load categories.');
}

// Published articles matching `query`, plus the total match count across all pages.
export async function getArticlesServer(
  query: ListArticlesQuery = {}
): Promise<{ items: ArticleListItemDto[]; total: number }> {
  const res = await publicGet(`/articles${buildArticlesQueryString(query)}`, 'Failed to load articles.');
  if (!res) return { items: [], total: 0 };
  const items = (await res.json()) as ArticleListItemDto[];
  const total = Number(res.headers.get(ARTICLES_TOTAL_COUNT_HEADER) ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

// Public teaser (no body) of one published article by UUID or slug; null if there's none. cache()d
// per request — generateMetadata and the page both read it.
export const getArticlePreviewServer = cache(async (idOrSlug: string): Promise<ArticleListItemDto | null> => {
  const res = await publicGet(`/articles/${encodeURIComponent(idOrSlug)}/preview`, 'Failed to load article.');
  return res ? ((await res.json()) as ArticleListItemDto) : null;
});

// Returns the caller's own articles regardless of status.
export function getMyArticlesServer(): Promise<ArticleListItemDto[]> {
  return authedGet<ArticleListItemDto[], ArticleListItemDto[]>('/articles/me', {
    signedOut: [],
    errorMessage: 'Failed to load your articles.',
  });
}

// Returns articles for the admin review queue.
export function getAdminArticlesServer(status?: string): Promise<AdminArticleListItemDto[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return authedGet<AdminArticleListItemDto[], AdminArticleListItemDto[]>(`/admin/articles${qs}`, {
    signedOut: [],
    errorMessage: 'Failed to load articles for review.',
  });
}

// Admin AI-generations log — newest first, optionally narrowed to one status.
export function getAdminAiGenerationsServer(status?: AiGenerationStatus): Promise<AdminAiGenerationListItemDto[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return authedGet<AdminAiGenerationListItemDto[], AdminAiGenerationListItemDto[]>(`/admin/ai-generations${qs}`, {
    signedOut: [],
    errorMessage: 'Failed to load AI generations.',
  });
}

// One AI generation's full inputs + output, or null if signed out or not found.
export function getAdminAiGenerationServer(id: string): Promise<AdminAiGenerationDetailDto | null> {
  return authedGet<AdminAiGenerationDetailDto, null>(`/admin/ai-generations/${encodeURIComponent(id)}`, {
    signedOut: null,
    emptyOn: [400, 404],
    errorMessage: 'Failed to load AI generation.',
  });
}

// Returns a single article's full detail (by UUID or slug), or null if signed out or not found.
// cache()d per request — generateMetadata and the page both read it.
export const getArticleServer = cache(
  (idOrSlug: string): Promise<ArticleDto | null> =>
    authedGet<ArticleDto, null>(`/articles/${encodeURIComponent(idOrSlug)}`, {
      signedOut: null,
      emptyOn: [401, 404],
      errorMessage: 'Failed to load article.',
    })
);

// The dashboard's upcoming list (not-yet-ended events, soonest first).
export function getEventsServer(): Promise<EventDto[]> {
  return publicList<EventDto>('/events', 'Failed to load events.');
}

// One server-filtered page of published events (past and upcoming) plus the total match count.
// The home calendar's month (see GET /v1/events/calendar); empty on failure.
export async function getEventCalendarServer(from: string, to: string): Promise<EventCalendarResponse> {
  const res = await publicGet(
    `/events/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    'Failed to load the events calendar.'
  );
  return res ? ((await res.json()) as EventCalendarResponse) : { days: [] };
}

export async function getEventsPageServer(query: ListEventsQuery): Promise<{ items: EventDto[]; total: number }> {
  const res = await publicGet(
    `/events${buildEventsQueryString({ ...query, upcoming: 'false' })}`,
    'Failed to load events.'
  );
  if (!res) return { items: [], total: 0 };
  const items = (await res.json()) as EventDto[];
  const total = Number(res.headers.get(EVENTS_TOTAL_COUNT_HEADER) ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

// Returns every event for the admin list, regardless of status.
export function getAdminEventsServer(): Promise<EventDto[]> {
  return authedGet<EventDto[], EventDto[]>('/admin/events', {
    signedOut: [],
    errorMessage: 'Failed to load events.',
  });
}

// Returns a single event for the admin edit page, or null if not found.
export function getAdminEventServer(id: string): Promise<EventDto | null> {
  return authedGet<EventDto, null>(`/admin/events/${encodeURIComponent(id)}`, {
    signedOut: null,
    emptyOn: [400, 404],
    errorMessage: 'Failed to load event.',
  });
}

// Admin profile-edit queue — every member's edits with the given status (default: pending).
export function getAdminMemberEditsServer(status: MemberEditStatusFilter = 'pending'): Promise<MemberProfileEditDto[]> {
  return authedGet<MemberProfileEditDto[], MemberProfileEditDto[]>(
    `/admin/member-edits?status=${encodeURIComponent(status)}`,
    { signedOut: [], errorMessage: 'Failed to load profile edits.' }
  );
}

// One member's edits + live section values for the admin review page, or null if not found.
export function getAdminMemberEditsDetailServer(memberId: string): Promise<AdminMemberEditsDetailDto | null> {
  return authedGet<AdminMemberEditsDetailDto, null>(`/admin/members/${encodeURIComponent(memberId)}/edits`, {
    signedOut: null,
    emptyOn: [400, 404],
    errorMessage: 'Failed to load profile edits.',
  });
}
