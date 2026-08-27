# Member Directory & Profile Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/members` directory and `/members/[id]` profile pages in `apps/frontend/`,
including a new shared sidebar app shell and the full 8-section self-edit proposal flow, against
the already-fixed backend contract (`docs/rest-api.md`, `packages/shared-types/member.ts`).

**Architecture:** Next.js App Router, Server Components for initial data fetch (`lib/api/server.ts`,
extended), Client Components for interactivity (filters, infinite scroll, tabs, edit modal). One
new route group `app/(shell)/` wraps both pages in a reusable sidebar shell that future sessions
(articles, events, dashboard) will also use. All styling via existing Tailwind design tokens
(`docs/design-system.md`) and `components/ui/*` — two new base primitives are added
(`FilterPopover`, `Modal`).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, `@supabase/ssr`, existing
`apiFetch`/`ApiError` client. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-24-member-directory-profile-design.md`

## Global Constraints

- TypeScript strict mode, no `any` (per root `CLAUDE.md`).
- All frontend API calls go through `apiFetch` (client) or the hand-written `fetch` + `ApiError`
  pattern already used in `lib/api/server.ts` (Server Components) — never raw `fetch` from a
  Client Component, never a new ad hoc pattern.
- `import type` only for anything from `@shared/*` (`packages/shared-types/`).
- No test infrastructure exists in `apps/frontend` (confirmed: no test script, no `*.test.*`
  files) — every task's verification step is `pnpm --filter ./apps/frontend typecheck` plus a
  manual `pnpm --filter ./apps/frontend dev` browser check, checked at 375px and 1440px per the
  Code Quality Bar. This is a deliberate adaptation of this skill's usual TDD loop to match this
  codebase's actual, established convention — not a shortcut.
- Tailwind only, no custom CSS files. Use `docs/design-system.md` tokens
  (`text-heading`, `bg-bg-alt`, `rounded-card`, etc.) — no hardcoded hex values, no arbitrary
  `text-[Npx]` unless truly one-off.
- Mobile-first responsive, checked at 375px and 1440px minimum, for every component touched.
- Backend, schema, `docs/rest-api.md`, `docs/database-erd.md`, `packages/shared-types/` are **not
  modified** by this plan — the contract is fixed.
- "Request Consultation" CTAs render present but `disabled` — no consultations backend exists.
- No admin review UI (`🛡️` routes) — out of scope, separate future session.

---

## Task 1: Member/article data layer — server-side fetchers

**Files:**
- Modify: `apps/frontend/lib/api/server.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`), `ApiError`/nothing else new
  (`@/lib/api/client`), `getApiBaseUrlServer` (`@/lib/api/base-url.server`), `MemberListItemDto`,
  `MemberDto`, `MemberProfileEditDto` (`@shared/member`).
- Produces (used by Task 10 and Task 17's pages):
  `getMembersServer(queryString: string): Promise<MemberListItemDto[]>`,
  `getMemberServer(id: string): Promise<MemberDto | null>`,
  `getMyMemberEditsServer(id: string): Promise<MemberProfileEditDto[]>`,
  `getPracticeAreasServer(): Promise<PracticeAreaDto[]>`.

**Why `getPracticeAreasServer` is needed even though `lib/api/practice-areas.ts` already exists:**
that file's `getPracticeAreas()` goes through `apiFetch`, which imports
`@/lib/supabase/client` — a file marked `'use client'`. Calling it from a Server Component (Task
10's directory page needs the practice-area list for its filter bar) would execute
`createBrowserClient()`'s session lookup in the Node server process, where `window`/`localStorage`
don't exist — it's not just a lint violation, it fails at runtime. `getPracticeAreasServer` sidesteps
this with a plain unauthenticated `fetch` (the endpoint is `🌐` public, confirmed in
`docs/rest-api.md` — no session/cookie lookup needed at all, simpler than the other three
functions above).

- [ ] **Step 1: Add the three server-side fetchers to `lib/api/server.ts`**

Append to the existing file (keep `getMyApplicationServer` as-is above these):

```typescript
import type { MemberDto, MemberListItemDto, MemberProfileEditDto } from '@shared/member';
import type { PracticeAreaDto } from '@shared/practice-area';

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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors. (No page imports these yet, so this only checks the file itself compiles.)

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/lib/api/server.ts
git commit -m "feat(members): add server-side member/edit fetchers"
```

---

## Task 2: Member/article/upload data layer — client-side

**Files:**
- Create: `apps/frontend/lib/members/search-params.ts`
- Create: `apps/frontend/lib/api/members.ts`
- Create: `apps/frontend/lib/api/upload.ts`
- Create: `apps/frontend/lib/api/articles.ts`

**Interfaces:**
- Consumes: `apiFetch` (`@/lib/api/client`), shared types from `@shared/member` and
  `@shared/article`.
- Produces (used throughout — Tasks 8, 9, 10, 15, 16, 19):
  `MemberFilters`, `DEFAULT_SORT`, `parseMemberFilters(searchParams)`,
  `filtersToSearchParams(filters)` (`lib/members/search-params.ts`);
  `GetMembersParams`, `getMembers(params)`, `getMember(id)`, `getMyMemberEdits(id)`,
  `createMemberEdit(id, body)`, `requestMemberUpload(id, body)` (`lib/api/members.ts`);
  `uploadToSignedUrl(uploadUrl, file)` (`lib/api/upload.ts`);
  `getArticles(params)` (`lib/api/articles.ts`).

- [ ] **Step 1: Write `lib/members/search-params.ts`**

```typescript
// Single source of truth for the directory's filter shape, shared between:
// - the Server Component's initial searchParams read (Task 10)
// - the client filter bar's URL sync (Task 8)
// - getMembers()'s query-string construction (this file, below)
// Keeping parse/serialize together means the URL's shape can only drift in
// one place, not three.

export type MemberSort = 'featured' | 'tenure' | 'rate_asc' | 'rate_desc';

export const DEFAULT_SORT: MemberSort = 'featured';

export interface MemberFilters {
  q?: string;
  practiceAreaId: string[];
  country: string[];
  rateMinCents?: number;
  rateMaxCents?: number;
  sort: MemberSort;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseMemberFilters(searchParams: RawSearchParams): MemberFilters {
  return {
    q: toSingleTrimmed(searchParams.q),
    practiceAreaId: toArray(searchParams.practiceAreaId),
    country: toArray(searchParams.country),
    rateMinCents: toNumber(searchParams.rateMinCents),
    rateMaxCents: toNumber(searchParams.rateMaxCents),
    sort: toSort(searchParams.sort),
  };
}

export function filtersToSearchParams(filters: MemberFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const id of filters.practiceAreaId) params.append('practiceAreaId', id);
  for (const country of filters.country) params.append('country', country);
  if (filters.rateMinCents !== undefined) params.set('rateMinCents', String(filters.rateMinCents));
  if (filters.rateMaxCents !== undefined) params.set('rateMaxCents', String(filters.rateMaxCents));
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  return params;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toSingleTrimmed(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function toNumber(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function toSort(value: string | string[] | undefined): MemberSort {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'featured' || raw === 'tenure' || raw === 'rate_asc' || raw === 'rate_desc') {
    return raw;
  }
  return DEFAULT_SORT;
}
```

- [ ] **Step 2: Write `lib/api/members.ts`**

```typescript
import { apiFetch } from '@/lib/api/client';
import { filtersToSearchParams, type MemberFilters } from '@/lib/members/search-params';
import type {
  CreateMemberEditRequest,
  MemberDto,
  MemberListItemDto,
  MemberProfileEditDto,
  UploadRequest,
  UploadResponse,
} from '@shared/member';

export interface GetMembersParams extends MemberFilters {
  page?: number;
  pageSize?: number;
}

export function buildMembersQueryString(params: GetMembersParams): string {
  const search = filtersToSearchParams(params);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function getMembers(params: GetMembersParams): Promise<MemberListItemDto[]> {
  return apiFetch<MemberListItemDto[]>(`/members${buildMembersQueryString(params)}`);
}

export function getMember(id: string): Promise<MemberDto> {
  return apiFetch<MemberDto>(`/members/${id}`);
}

export function getMyMemberEdits(id: string): Promise<MemberProfileEditDto[]> {
  return apiFetch<MemberProfileEditDto[]>(`/members/${id}/edits`);
}

export function createMemberEdit(
  id: string,
  body: CreateMemberEditRequest
): Promise<MemberProfileEditDto> {
  return apiFetch<MemberProfileEditDto>(`/members/${id}/edits`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function requestMemberUpload(id: string, body: UploadRequest): Promise<UploadResponse> {
  return apiFetch<UploadResponse>(`/members/${id}/uploads`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 3: Write `lib/api/upload.ts`**

```typescript
// Raw PUT straight to Supabase Storage's signed URL — not apiFetch (that
// prefixes /v1 and attaches a Bearer token, neither of which applies here;
// the signed URL itself is the auth). See docs/rest-api.md's
// POST /v1/members/:id/uploads note: this endpoint never sees file bytes.
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`Upload failed (status ${res.status}). Please try again.`);
  }
}
```

- [ ] **Step 4: Write `lib/api/articles.ts`**

```typescript
import { apiFetch } from '@/lib/api/client';
import type { ArticleListItemDto } from '@shared/article';

// First client-side articles fetcher in the app — only `authorId` is needed
// for the profile page's Articles tab (Task 15). Category/country filtering
// exists on the backend too but has no caller yet; add params here if/when
// a future articles-browse session needs them, not speculatively now.
export function getArticles(params: { authorId?: string } = {}): Promise<ArticleListItemDto[]> {
  const search = new URLSearchParams();
  if (params.authorId) search.set('authorId', params.authorId);
  const qs = search.toString();
  return apiFetch<ArticleListItemDto[]>(`/articles${qs ? `?${qs}` : ''}`);
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/lib/members/search-params.ts apps/frontend/lib/api/members.ts apps/frontend/lib/api/upload.ts apps/frontend/lib/api/articles.ts
git commit -m "feat(members): add client-side member/article/upload data layer"
```

---

## Task 3: Pure helpers — completion %, edit badges, formatting, filter option data

**Files:**
- Create: `apps/frontend/lib/members/completion.ts`
- Create: `apps/frontend/lib/members/edit-badge.ts`
- Create: `apps/frontend/lib/members/format.ts`
- Create: `apps/frontend/lib/members/countries.ts`
- Create: `apps/frontend/lib/members/rate-buckets.ts`

**Interfaces:**
- Consumes: `MemberDto`, `MemberEditSection`, `MemberProfileEditDto` from `@shared/member`.
- Produces (used by Tasks 7, 8, 12, 13, 14, 16, 19):
  `computeCompletionPct(member): number`; `getSectionEditBadge(section, edits): 'pending' | null`;
  `formatTenure(years): string`, `formatRate(minCents, maxCents, currency): string`;
  `ALL_COUNTRIES: string[]`; `RATE_BUCKETS: RateBucket[]`.

- [ ] **Step 1: Write `lib/members/completion.ts`**

```typescript
import type { MemberDto } from '@shared/member';

const TOTAL_CHECKS = 10;

// Ports the prototype's own 10-point profile-completeness checklist onto
// MemberDto's real field names (confirmed by direct read of
// design/static_html/assets member-profile.html's completion logic — see
// the design spec §4.3). Evenly weighted, no per-item scoring.
export function computeCompletionPct(member: MemberDto): number {
  const checks = [
    Boolean(member.photoUrl),
    Boolean(member.headline),
    Boolean(member.bio),
    member.engagements.length > 0,
    member.educations.length > 0,
    member.workExperiences.length > 0,
    Boolean(member.contactEmail),
    Boolean(member.contactPhone),
    Boolean(member.linkedinUrl),
    Boolean(member.rateMinCents && member.rateMaxCents),
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / TOTAL_CHECKS) * 100);
}
```

- [ ] **Step 2: Write `lib/members/edit-badge.ts`**

```typescript
import type { MemberEditSection, MemberProfileEditDto } from '@shared/member';

// Per the prototype's own explicit design decision (confirmed by direct
// read): education/work_experiences show no section-level pending badge —
// "too many small, evolving facts to badge individually there". Edits still
// submit normally for these sections; only the badge UI is suppressed.
const NO_BADGE_SECTIONS: readonly MemberEditSection[] = ['education', 'work_experiences'];

export function getSectionEditBadge(
  section: MemberEditSection,
  edits: MemberProfileEditDto[]
): 'pending' | null {
  if (NO_BADGE_SECTIONS.includes(section)) return null;

  const latest = edits
    .filter((edit) => edit.section === section)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];

  return latest?.status === 'pending' ? 'pending' : null;
}
```

- [ ] **Step 3: Write `lib/members/format.ts`**

```typescript
// GET /v1/members intentionally omits display strings ("18y", "$420/hr") —
// docs/rest-api.md: format them client-side from the numeric fields. These
// two functions are that formatting, used by MemberCard and ProfileSidebar.

export function formatTenure(years: number): string {
  return `${years}y`;
}

export function formatRate(
  minCents: number | null,
  maxCents: number | null,
  currency: string
): string {
  if (minCents === null || maxCents === null) return 'Rate on request';
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  const min = Math.round(minCents / 100);
  const max = Math.round(maxCents / 100);
  return min === max ? `${symbol}${min}/hr` : `${symbol}${min}–${max}/hr`;
}
```

- [ ] **Step 4: Write `lib/members/countries.ts`**

Copied verbatim from `design/static_html/members.html`'s `ALL_COUNTRIES` (line 303) — the
directory filter's country option set must match whatever free-form `country` strings could
plausibly exist on a real `member_profiles` row, so this stays a complete list, not the shorter
19-country list `components/apply/types.ts`'s `COUNTRIES` uses for the application wizard's
"where are you based" picker (a different, narrower purpose — deliberately not reused).

```typescript
export const ALL_COUNTRIES: string[] = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
  'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
  'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
  'Comoros', 'Congo, Democratic Republic of the', 'Congo, Republic of the', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
  'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
  'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain',
  'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Tajikistan', 'Tanzania',
  'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen', 'Zambia', 'Zimbabwe',
];
```

- [ ] **Step 5: Write `lib/members/rate-buckets.ts`**

```typescript
// Prototype's own price buckets (design/static_html/members.html's
// PRICE_RANGES), converted to the contract's rateMinCents/rateMaxCents
// (×100). The '600 and up' bucket omits rateMaxCents entirely rather than
// sending an arbitrary ceiling — GET /v1/members treats a missing param as
// "no upper bound", which is the correct semantics here, not the
// prototype's internal 999999 sentinel.
export interface RateBucket {
  label: string;
  rateMinCents?: number;
  rateMaxCents?: number;
}

export const RATE_BUCKETS: RateBucket[] = [
  { label: 'Under $300/hr', rateMaxCents: 30_000 },
  { label: '$300 – $400/hr', rateMinCents: 30_000, rateMaxCents: 40_000 },
  { label: '$400 – $500/hr', rateMinCents: 40_000, rateMaxCents: 50_000 },
  { label: '$500 – $600/hr', rateMinCents: 50_000, rateMaxCents: 60_000 },
  { label: '$600/hr and up', rateMinCents: 60_000 },
];
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/lib/members/
git commit -m "feat(members): add completion/badge/format/filter-option pure helpers"
```

---

## Task 4: New base primitive — `FilterPopover`

**Files:**
- Create: `apps/frontend/components/ui/FilterPopover.tsx`
- Modify: `apps/frontend/components/ui/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 8): `FilterPopover` component with props
  `{ label: string; options: {value: string; label: string}[]; selected: string[];
  onChange: (values: string[]) => void; multi?: boolean; searchable?: boolean }`.

- [ ] **Step 1: Write `components/ui/FilterPopover.tsx`**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

export interface FilterPopoverOption {
  value: string;
  label: string;
}

// A checkbox/radio popover for filter controls that need multi-select
// and/or in-list search — native <select> (see Select.tsx) can't do either.
// New base primitive because the directory's practice/country/rate/sort
// filters all need this shape; documented in docs/design-system.md (Task 20).
export function FilterPopover({
  label,
  options,
  selected,
  onChange,
  multi = true,
  searchable = true,
}: {
  label: string;
  options: FilterPopoverOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  multi?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const triggerLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${label} (${selected.length})`;

  function toggle(value: string) {
    if (multi) {
      onChange(
        selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
      );
    } else {
      onChange([value]);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-input border px-4 py-2.5 text-sm font-medium transition-colors ${
          selected.length > 0
            ? 'border-ink bg-bg-card text-ink'
            : 'border-line-2 bg-bg-card text-ink-2 hover:border-ink'
        }`}
      >
        {triggerLabel}
        <span className="text-ink-4">▾</span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${label} filter`}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="ml-1 text-ink-4 hover:text-ink"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 max-h-80 w-64 overflow-hidden rounded-xl border border-line bg-bg-card shadow-lg">
          {searchable && (
            <div className="border-b border-line p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-ink"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-sm text-ink-3">No matches</div>
            )}
            {filtered.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-bg-alt"
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export from `components/ui/index.ts`**

Add this line (matching the existing alphabetical-ish grouping):

```typescript
export { FilterPopover } from './FilterPopover';
export type { FilterPopoverOption } from './FilterPopover';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/ui/FilterPopover.tsx apps/frontend/components/ui/index.ts
git commit -m "feat(ui): add FilterPopover base primitive"
```

---

## Task 5: New base primitive — `Modal`

**Files:**
- Create: `apps/frontend/components/ui/Modal.tsx`
- Modify: `apps/frontend/components/ui/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 19): `Modal` component with props
  `{ open: boolean; onClose: () => void; title: string; children: ReactNode }`.

- [ ] **Step 1: Write `components/ui/Modal.tsx`**

```typescript
'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

// No modal primitive existed anywhere in the app before this — the only
// current overlay-shaped UI is the auth pages, which are full pages, not
// modals. Built here because SectionEditModal (Task 19) is this app's first
// real dialog; documented in docs/design-system.md (Task 20) for reuse.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card border border-line bg-bg-card p-6 max-[640px]:p-5"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="modal-title" className="text-title text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-3 hover:text-ink"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from `components/ui/index.ts`**

```typescript
export { Modal } from './Modal';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/ui/Modal.tsx apps/frontend/components/ui/index.ts
git commit -m "feat(ui): add Modal base primitive"
```

---

## Task 6: App shell — Sidebar, mobile drawer, layout, route group

**Files:**
- Create: `apps/frontend/components/layout/Sidebar.tsx`
- Create: `apps/frontend/components/layout/SignOutButton.tsx`
- Create: `apps/frontend/components/layout/MobileDrawer.tsx`
- Create: `apps/frontend/components/layout/AppShell.tsx`
- Create: `apps/frontend/app/(shell)/layout.tsx`

**Interfaces:**
- Consumes: `getSessionUser` (`@/lib/auth/session-claims`), `Profile` type
  (`@/lib/auth/types`), `Logo` (`@/components/Logo`, `variant="sidebar"` — already exists),
  `Button` (`@/components/ui`), `createClient` (`@/lib/supabase/client`, for sign-out).
- Produces (used by Task 10 and Task 17 implicitly via the route group; no direct import needed
  by page files): the `(shell)` layout wraps any page placed under `app/(shell)/`.

- [ ] **Step 1: Write `components/layout/Sidebar.tsx`**

```typescript
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import type { Profile } from '@/lib/auth/types';
import { SignOutButton } from '@/components/layout/SignOutButton';

// Desktop sidebar content, reused (without the fixed positioning) inside
// MobileDrawer too — see that file. Only "Members" is a real nav
// destination today; Articles/Events/Dashboard/etc. are deliberately absent
// until their own sessions ship (not placeholder links to pages that 404).
export function SidebarNav({ user }: { user: Profile | null }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      <Link
        href="/members"
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        Members
      </Link>
      {!user && (
        <Link
          href="/membership"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="6" />
            <path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5" />
          </svg>
          Expertly Benefits
        </Link>
      )}
    </nav>
  );
}

export function SidebarFooter({ user }: { user: Profile | null }) {
  if (!user) {
    return (
      <div className="flex flex-col gap-2 px-3 pb-4">
        <Button href="/apply" size="sm" fullWidth>
          Apply Now
        </Button>
        <Button href="/login" variant="ghost" size="sm" fullWidth className="text-white/80 hover:bg-white/10 hover:text-white">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-4">
      <span className="truncate text-sm text-white/80">
        {user.first_name} {user.last_name}
      </span>
      <SignOutButton />
    </div>
  );
}

export function Sidebar({ user }: { user: Profile | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-nav-green max-[1023px]:hidden">
      <div className="px-5 py-6">
        <Logo variant="sidebar" />
      </div>
      <SidebarNav user={user} />
      <SidebarFooter user={user} />
    </aside>
  );
}
```

- [ ] **Step 2: Write `components/layout/SignOutButton.tsx`**

(Small enough to fold in here rather than a separate task — it's a one-off used only by the
sidebar footer.)

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="Sign out"
      className="text-white/60 hover:text-white"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 3: Write `components/layout/MobileDrawer.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { SidebarNav, SidebarFooter } from '@/components/layout/Sidebar';
import type { Profile } from '@/lib/auth/types';

// Mobile-only (below 1024px, matching Sidebar's own breakpoint and the
// profile page's mobile CTA bar breakpoint — one number for the whole
// shell). No prototype reference for this collapse; built fresh per
// CLAUDE.md's mobile-first mandate.
export function MobileDrawer({ user }: { user: Profile | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg-card px-4 py-3 min-[1024px]:hidden">
        <Logo variant="nav" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-1.5 text-ink"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 min-[1024px]:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-nav-green pb-4">
            <div className="flex items-center justify-between px-5 py-6">
              <Logo variant="sidebar" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
            <SidebarNav user={user} />
            <SidebarFooter user={user} />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Write `components/layout/AppShell.tsx`**

```typescript
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import type { Profile } from '@/lib/auth/types';

export function AppShell({ user, children }: { user: Profile | null; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar user={user} />
      <MobileDrawer user={user} />
      <main className="min-[1024px]:pl-64">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Write `app/(shell)/layout.tsx`**

```typescript
import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth/session-claims';
import { AppShell } from '@/components/layout/AppShell';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return <AppShell user={user}>{children}</AppShell>;
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors. (Route group has no pages yet, so this only checks the shell files compile —
full visual verification happens once Task 10 gives it a page to render.)

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/components/layout/ "apps/frontend/app/(shell)/layout.tsx"
git commit -m "feat(layout): add sidebar app shell and mobile drawer"
```

---

## Task 7: `MemberCard`

**Files:**
- Create: `apps/frontend/components/members/MemberCard.tsx`

**Interfaces:**
- Consumes: `MemberListItemDto` (`@shared/member`), `Badge` (`@/components/ui`),
  `formatTenure`/`formatRate` (`@/lib/members/format`).
- Produces (used by Task 9): `MemberCard` component, prop `{ member: MemberListItemDto }`.

- [ ] **Step 1: Write `components/members/MemberCard.tsx`**

```typescript
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatRate, formatTenure } from '@/lib/members/format';
import type { MemberListItemDto } from '@shared/member';

export function MemberCard({ member }: { member: MemberListItemDto }) {
  const location = [member.city, member.country].filter(Boolean).join(', ');
  const visiblePracticeAreas = member.practiceAreas.slice(0, 3);
  const extraCount = member.practiceAreas.length - visiblePracticeAreas.length;

  return (
    <Link
      href={`/members/${member.id}`}
      className="flex flex-col gap-4 rounded-card border border-line bg-bg-card p-6 transition-colors hover:border-line-2"
    >
      <div className="flex items-start gap-4">
        {member.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photoUrl}
            alt={member.name}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neon text-sm font-semibold text-ink-2">
            {member.initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-title text-ink">{member.name}</span>
            {member.isVerified && <Badge variant="brand">Verified</Badge>}
          </div>
          {member.headline && <p className="mt-0.5 truncate text-sm text-ink-3">{member.headline}</p>}
          {member.firmName && <p className="truncate text-xs text-ink-3">{member.firmName}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visiblePracticeAreas.map((area) => (
          <Badge key={area.id} variant="neutral">
            {area.name}
          </Badge>
        ))}
        {extraCount > 0 && <Badge variant="neutral">+{extraCount}</Badge>}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="text-ink-3">{location || '—'}</span>
        <span className="text-ink-2">{formatTenure(member.yearsOfExperience)}</span>
        <span className="font-medium text-ink">
          {formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/members/MemberCard.tsx
git commit -m "feat(members): add MemberCard"
```

---

## Task 8: `DirectoryFilterBar`

**Files:**
- Create: `apps/frontend/components/members/DirectoryFilterBar.tsx`

**Interfaces:**
- Consumes: `FilterPopover` (`@/components/ui`), `PracticeAreaDto` (`@shared/practice-area`),
  `MemberFilters`/`filtersToSearchParams` (`@/lib/members/search-params`), `ALL_COUNTRIES`
  (`@/lib/members/countries`), `RATE_BUCKETS` (`@/lib/members/rate-buckets`).
- Produces (used by Task 10): `DirectoryFilterBar` component, props
  `{ practiceAreas: PracticeAreaDto[]; filters: MemberFilters }`. Reads/writes filter state via
  `next/navigation`'s `useRouter`/`usePathname` — no callback prop needed, it owns the URL sync.

- [ ] **Step 1: Write `components/members/DirectoryFilterBar.tsx`**

```typescript
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { FilterPopover } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { RATE_BUCKETS } from '@/lib/members/rate-buckets';
import { filtersToSearchParams, type MemberFilters, type MemberSort } from '@/lib/members/search-params';
import type { PracticeAreaDto } from '@shared/practice-area';

const SORT_OPTIONS: { value: MemberSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'tenure', label: 'Most experienced' },
  { value: 'rate_asc', label: 'Rate: low → high' },
  { value: 'rate_desc', label: 'Rate: high → low' },
];

function rateBucketValue(filters: MemberFilters): string[] {
  const match = RATE_BUCKETS.find(
    (b) => b.rateMinCents === filters.rateMinCents && b.rateMaxCents === filters.rateMaxCents
  );
  return match ? [match.label] : [];
}

export function DirectoryFilterBar({
  practiceAreas,
  filters,
}: {
  practiceAreas: PracticeAreaDto[];
  filters: MemberFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q ?? '');

  function apply(next: MemberFilters) {
    const params = filtersToSearchParams(next);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply({ ...filters, q: q.trim() || undefined });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSearchSubmit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, practice, location, firm…"
          className="w-full rounded-input border border-line bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-input bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-ink-2"
        >
          Find
        </button>
      </form>

      <div className="flex flex-wrap gap-2.5">
        <FilterPopover
          label="All practices"
          options={practiceAreas.map((p) => ({ value: p.id, label: p.name }))}
          selected={filters.practiceAreaId}
          onChange={(practiceAreaId) => apply({ ...filters, practiceAreaId })}
        />
        <FilterPopover
          label="All countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={filters.country}
          onChange={(country) => apply({ ...filters, country })}
        />
        <FilterPopover
          label="All prices"
          multi={false}
          searchable={false}
          options={RATE_BUCKETS.map((b) => ({ value: b.label, label: b.label }))}
          selected={rateBucketValue(filters)}
          onChange={(values) => {
            const bucket = RATE_BUCKETS.find((b) => b.label === values[0]);
            apply({
              ...filters,
              rateMinCents: bucket?.rateMinCents,
              rateMaxCents: bucket?.rateMaxCents,
            });
          }}
        />
        <FilterPopover
          label="Featured"
          multi={false}
          searchable={false}
          options={SORT_OPTIONS}
          selected={[filters.sort]}
          onChange={(values) => apply({ ...filters, sort: (values[0] as MemberSort) ?? 'featured' })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/members/DirectoryFilterBar.tsx
git commit -m "feat(members): add DirectoryFilterBar"
```

---

## Task 9: `DirectorySidebar` and `MemberDirectoryList`

**Files:**
- Create: `apps/frontend/components/members/DirectorySidebar.tsx`
- Create: `apps/frontend/components/members/MemberDirectoryList.tsx`

**Interfaces:**
- Consumes: `Card`, `Button` (`@/components/ui`), `MemberCard` (Task 7), `getMembers`
  (`@/lib/api/members`), `MemberListItemDto` (`@shared/member`), `MemberFilters`
  (`@/lib/members/search-params`).
- Produces (used by Task 10): `DirectorySidebar` (no props); `MemberDirectoryList` component,
  props `{ initialMembers: MemberListItemDto[]; filters: MemberFilters }`.

- [ ] **Step 1: Write `components/members/DirectorySidebar.tsx`**

```typescript
import { Card, Button } from '@/components/ui';

// Static trust-signal marketing copy, ported verbatim from
// design/static_html/members.html's sidebar — not data, no fetch needed.
export function DirectorySidebar() {
  return (
    <aside className="flex flex-col gap-5 max-[1023px]:order-first">
      <Card>
        <h3 className="text-title text-ink">Every member is individually vetted.</h3>
        <p className="mt-2 text-sm text-ink-3">
          Our screening covers credentials, years in practice, jurisdiction expertise, and a peer
          review by existing members. No self-serve listings.
        </p>
        <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5">
          <div>
            <div className="text-stat text-ink">100%</div>
            <p className="text-xs text-ink-3">
              <b>Manual review</b>: every profile is personally verified by our team before going
              live.
            </p>
          </div>
          <div>
            <div className="text-stat text-ink">0</div>
            <p className="text-xs text-ink-3">
              <b>Junior associates</b>: every member is a partner-level, senior, or founder
              practitioner.
            </p>
          </div>
          <div>
            <div className="text-stat text-ink">20+</div>
            <p className="text-xs text-ink-3">
              <b>Jurisdictions</b> covered: from Chennai and Singapore to London, Dubai, and New
              York.
            </p>
          </div>
        </div>
      </Card>
      <Card className="bg-bg-alt">
        <span className="text-mono-label text-accent">FOR PRACTITIONERS</span>
        <h3 className="mt-2 text-title text-ink">Join the network.</h3>
        <p className="mt-2 text-sm text-ink-3">
          Apply for membership and get discovered by clients globally. Keep 100% of your fees.
        </p>
        <Button href="/apply" className="mt-4" fullWidth>
          Apply for membership →
        </Button>
      </Card>
    </aside>
  );
}
```

- [ ] **Step 2: Write `components/members/MemberDirectoryList.tsx`**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { MemberCard } from '@/components/members/MemberCard';
import { Button } from '@/components/ui';
import { getMembers } from '@/lib/api/members';
import { ApiError } from '@/lib/api/client';
import type { MemberListItemDto } from '@shared/member';
import type { MemberFilters } from '@/lib/members/search-params';

const PAGE_SIZE = 8;

export function MemberDirectoryList({
  initialMembers,
  filters,
}: {
  initialMembers: MemberListItemDto[];
  filters: MemberFilters;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialMembers.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters changed (new URL) — reset to the server-provided first page.
  useEffect(() => {
    setMembers(initialMembers);
    setPage(1);
    setHasMore(initialMembers.length === PAGE_SIZE);
    setError(null);
  }, [initialMembers]);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, page, filters]);

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const results = await getMembers({ ...filters, page: nextPage, pageSize: PAGE_SIZE });
      setMembers((prev) => [...prev, ...results]);
      setPage(nextPage);
      setHasMore(results.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more members.');
    } finally {
      setLoading(false);
    }
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-line py-16 text-center">
        <span className="text-mono-label text-ink-3">No results</span>
        <h3 className="text-title text-ink">No members match those filters.</h3>
        <Button href="/members" variant="secondary">
          Reset filters
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
        {loading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-56 animate-pulse rounded-card bg-bg-alt" />
          ))}
      </div>
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-input border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={loadMore} className="font-medium underline">
            Retry
          </button>
        </div>
      )}
      <div ref={sentinelRef} className="h-px" />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/members/DirectorySidebar.tsx apps/frontend/components/members/MemberDirectoryList.tsx
git commit -m "feat(members): add DirectorySidebar and infinite-scroll MemberDirectoryList"
```

---

## Task 10: `/members` directory page

**Files:**
- Create: `apps/frontend/app/(shell)/members/page.tsx`
- Create: `apps/frontend/app/(shell)/members/error.tsx`

**Interfaces:**
- Consumes: `getMembersServer`/`getPracticeAreasServer` (Task 1),
  `parseMemberFilters`/`filtersToSearchParams` (Task 2),
  `DirectoryFilterBar`/`DirectorySidebar`/`MemberDirectoryList` (Tasks 8, 9).
- Produces: the `/members` route, publicly accessible (not in `middleware.ts`'s
  `PROTECTED_PREFIXES`).

- [ ] **Step 1: Write `app/(shell)/members/page.tsx`**

```typescript
import { getMembersServer, getPracticeAreasServer } from '@/lib/api/server';
import { buildMembersQueryString } from '@/lib/api/members';
import { parseMemberFilters } from '@/lib/members/search-params';
import { DirectoryFilterBar } from '@/components/members/DirectoryFilterBar';
import { DirectorySidebar } from '@/components/members/DirectorySidebar';
import { MemberDirectoryList } from '@/components/members/MemberDirectoryList';

const PAGE_SIZE = 8;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseMemberFilters(searchParams);
  const query = buildMembersQueryString({ ...filters, page: 1, pageSize: PAGE_SIZE });

  const [members, practiceAreas] = await Promise.all([
    getMembersServer(query),
    getPracticeAreasServer(),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 max-[640px]:px-4">
      <span className="text-eyebrow text-accent">MEMBER DIRECTORY</span>
      <h1 className="mt-2 text-headline text-ink">
        Hire verified <em className="italic text-accent">finance &amp; legal</em> counsel.
      </h1>
      <p className="mt-3 max-w-2xl text-lede text-ink-3">
        Every practitioner below has been individually credential-verified and peer-reviewed. No
        agencies, no intermediaries, direct access only.
      </p>

      <div className="mt-10 grid grid-cols-[1fr_320px] gap-8 max-[1023px]:grid-cols-1">
        <div>
          <DirectoryFilterBar practiceAreas={practiceAreas} filters={filters} />
          <div className="mt-6">
            <MemberDirectoryList initialMembers={members} filters={filters} />
          </div>
        </div>
        <DirectorySidebar />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(shell)/members/error.tsx`**

```typescript
'use client';

import { Button } from '@/components/ui';

export default function MembersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 py-24 text-center">
      <h2 className="text-title text-ink">Something went wrong loading this page.</h2>
      <p className="text-sm text-ink-3">{error.message || 'Please try again.'}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Run: `pnpm --filter ./apps/frontend dev`, then in a browser:
- Visit `http://localhost:3000/members`. Directory renders with sidebar shell, filter bar, member
  cards (or the empty state if the local backend has no seeded members — either is a valid pass).
- Resize to 375px: sidebar collapses to the mobile top bar + hamburger drawer; filter bar and
  cards stack to one column.
- Resize to 1440px: sidebar fixed left, two-column card grid, directory sidebar visible on the
  right.
- Apply a filter (e.g. select a practice area): URL updates with `?practiceAreaId=...`, list
  refetches.

Expected: no console errors, layout matches the above at both widths.

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/app/(shell)/members/page.tsx" "apps/frontend/app/(shell)/members/error.tsx"
git commit -m "feat(members): add /members directory page"
```

---

## Task 11: `ProfileAuthWall` and `SectionBadge`

**Files:**
- Create: `apps/frontend/components/members/ProfileAuthWall.tsx`
- Create: `apps/frontend/components/members/SectionBadge.tsx`

**Interfaces:**
- Consumes: `Button` (`@/components/ui`).
- Produces (used by Tasks 12, 13, 14, 16, 17): `ProfileAuthWall` (no props);
  `SectionBadge` component, prop `{ status: 'pending' | null }` (renders nothing for `null`).

- [ ] **Step 1: Write `components/members/ProfileAuthWall.tsx`**

```typescript
import { Button } from '@/components/ui';

// Generic copy, not personalized with the member's name — a deliberate
// deviation from the prototype (see design spec §3): the real
// GET /v1/members/:id 401s for guests entirely, so there's no way to source
// a name to personalize this with without a public by-id endpoint that
// doesn't exist in the contract.
export function ProfileAuthWall() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="text-heading text-ink">Sign in to view this profile</h1>
      <p className="text-sm text-ink-3">
        Sign in to view the full profile, including experience, services, and contact details.
      </p>
      <div className="mt-2 flex gap-3">
        <Button href="/login">Sign In</Button>
        <Button href="/apply" variant="secondary">
          Apply for membership
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/members/SectionBadge.tsx`**

```typescript
// Tailwind's default amber palette, not a design-system token — see the
// design spec §9: this is the first and only call site needing an
// in-review/caution color, so a new CSS-variable token isn't warranted yet.
export function SectionBadge({ status }: { status: 'pending' | null }) {
  if (status !== 'pending') return null;

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-amber-700">
      Pending verification
    </span>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/members/ProfileAuthWall.tsx apps/frontend/components/members/SectionBadge.tsx
git commit -m "feat(members): add ProfileAuthWall and SectionBadge"
```

---

## Task 12: `ProfileHeader`, `ProfileSidebar`, `MobileCtaBar`

**Files:**
- Create: `apps/frontend/components/members/ProfileHeader.tsx`
- Create: `apps/frontend/components/members/ProfileSidebar.tsx`
- Create: `apps/frontend/components/members/MobileCtaBar.tsx`

**Interfaces:**
- Consumes: `MemberDto` (`@shared/member`), `Badge`/`Card`/`Button` (`@/components/ui`),
  `formatTenure`/`formatRate` (`@/lib/members/format`), `computeCompletionPct`
  (`@/lib/members/completion`).
- Produces (used by Task 17): `ProfileHeader`, props `{ member: MemberDto }`; `ProfileSidebar`,
  props `{ member: MemberDto; isOwnProfile: boolean }`; `MobileCtaBar`, props
  `{ member: MemberDto }`.

- [ ] **Step 1: Write `components/members/ProfileHeader.tsx`**

```typescript
'use client';

import { Badge } from '@/components/ui';
import { formatTenure } from '@/lib/members/format';
import type { MemberDto } from '@shared/member';

const TIER_LABEL: Record<MemberDto['memberTier'], string> = {
  budding_entrepreneur: 'Budding Entrepreneur',
  seasoned_professional: 'Seasoned Professional',
};

export function ProfileHeader({ member }: { member: MemberDto }) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: member.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="flex items-start gap-5">
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.photoUrl}
          alt={member.name}
          className="h-20 w-20 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-neon text-lg font-semibold text-ink-2">
          {member.initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-heading text-ink">{member.name}</h1>
          {member.isVerified && <Badge variant="brand">Verified</Badge>}
          <Badge variant="emphasis">{TIER_LABEL[member.memberTier]}</Badge>
        </div>
        {member.headline && <p className="mt-1 text-sm text-ink-2">{member.headline}</p>}
        {member.firmName && <p className="text-sm text-ink-3">{member.firmName}</p>}
        <div className="mt-3 flex items-center gap-4 text-sm text-ink-3">
          <span>{formatTenure(member.yearsOfExperience)} experience</span>
          <span>
            {[member.city, member.country].filter(Boolean).join(', ')}
          </span>
          <button type="button" onClick={share} className="font-medium text-accent">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/members/ProfileSidebar.tsx`**

```typescript
import { Card, Badge, Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import { computeCompletionPct } from '@/lib/members/completion';
import type { MemberDto } from '@shared/member';

export function ProfileSidebar({
  member,
  isOwnProfile,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
}) {
  const pct = isOwnProfile ? computeCompletionPct(member) : null;

  return (
    <aside className="flex flex-col gap-5">
      <Card>
        <div className="text-title text-ink">
          {formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}
        </div>
        <p className="mt-1 text-sm text-ink-3">
          {member.isAvailable ? 'Available for new engagements' : 'Not currently available'}
        </p>
        {member.availabilityNotes && (
          <p className="mt-2 text-xs text-ink-3">{member.availabilityNotes}</p>
        )}
        <Button
          disabled
          aria-disabled="true"
          title="Coming soon"
          fullWidth
          className="mt-4"
        >
          Request Consultation
        </Button>
        {member.website && (
          <a
            href={member.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-sm font-medium text-accent"
          >
            Visit firm website →
          </a>
        )}
      </Card>

      {member.isVerified && (
        <Card>
          <Badge variant="brand">Verified</Badge>
          <p className="mt-2 text-sm text-ink-3">
            Credentials and experience personally verified by the Expertly team.
          </p>
        </Card>
      )}

      {isOwnProfile && pct !== null && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Profile completeness</span>
            <span className="text-sm font-medium text-ink">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-alt">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </Card>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Write `components/members/MobileCtaBar.tsx`**

```typescript
'use client';

import { formatRate } from '@/lib/members/format';
import type { MemberDto } from '@shared/member';

// Pure viewport-width trigger (min-[1024px]:hidden), always shown below
// 1024px regardless of any other state — matches the prototype's own
// unconditional CSS-only behavior exactly (see design spec §6).
export function MobileCtaBar({ member }: { member: MemberDto }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-line bg-bg-card px-4 py-3 min-[1024px]:hidden">
      <div>
        <div className="text-sm font-semibold text-ink">
          {formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}
        </div>
        <div className="text-xs text-ink-3">
          {member.isAvailable ? 'Available' : 'Not currently available'}
        </div>
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Coming soon"
        className="rounded-input bg-ink px-5 py-2.5 text-sm font-medium text-bg opacity-40"
      >
        Request Consultation
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/members/ProfileHeader.tsx apps/frontend/components/members/ProfileSidebar.tsx apps/frontend/components/members/MobileCtaBar.tsx
git commit -m "feat(members): add ProfileHeader, ProfileSidebar, MobileCtaBar"
```

---

## Task 13: `AboutTab` and `ContactTab`

**Files:**
- Create: `apps/frontend/components/members/tabs/AboutTab.tsx`
- Create: `apps/frontend/components/members/tabs/ContactTab.tsx`

**Interfaces:**
- Consumes: `MemberDto`, `MemberProfileEditDto` (`@shared/member`), `SectionBadge` (Task 11),
  `getSectionEditBadge` (`@/lib/members/edit-badge`), `Card`/`Button` (`@/components/ui`).
- Produces (used by Task 16): `AboutTab`, props
  `{ member: MemberDto; edits: MemberProfileEditDto[]; isOwnProfile: boolean;
  onEdit: (section: 'headline_bio' | 'engagements' | 'key_clients') => void }`;
  `ContactTab`, props `{ member: MemberDto; edits: MemberProfileEditDto[]; isOwnProfile: boolean;
  onEdit: (section: 'contact') => void }`.

- [ ] **Step 1: Write `components/members/tabs/AboutTab.tsx`**

```typescript
import { SectionBadge } from '@/components/members/SectionBadge';
import { getSectionEditBadge } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-medium text-accent">
      Edit
    </button>
  );
}

export function AboutTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'headline_bio' | 'engagements' | 'key_clients') => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Headline &amp; Bio</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('headline_bio', edits)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('headline_bio')} />}
          </div>
        </div>
        {member.headline && <p className="mt-2 font-medium text-ink">{member.headline}</p>}
        {member.bio && <p className="mt-2 whitespace-pre-line text-sm text-ink-3">{member.bio}</p>}
        {!member.headline && !member.bio && <p className="mt-2 text-sm text-ink-3">No bio yet.</p>}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Key Engagements</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('engagements', edits)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('engagements')} />}
          </div>
        </div>
        {member.engagements.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No engagements listed yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {member.engagements.map((eng) => (
              <li key={eng.id} className="rounded-xl border border-line p-4">
                <div className="font-medium text-ink">{eng.title}</div>
                <div className="text-sm text-ink-3">
                  {eng.organization}
                  {eng.year ? ` · ${eng.year}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Key Clients</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('key_clients', edits)} />
            {isOwnProfile && <EditButton onClick={() => onEdit('key_clients')} />}
          </div>
        </div>
        {member.keyClients.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No key clients listed yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-4 max-[640px]:grid-cols-2">
            {member.keyClients.map((client) => (
              <div
                key={client.id}
                className="flex h-16 items-center justify-center rounded-xl border border-line px-3"
              >
                {client.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={client.logoUrl} alt={client.name} className="max-h-8 max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-ink-3">{client.name}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/members/tabs/ContactTab.tsx`**

```typescript
import { SectionBadge } from '@/components/members/SectionBadge';
import { getSectionEditBadge } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

export function ContactTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'contact') => void;
}) {
  const rows: { label: string; value: string | null; href?: string }[] = [
    { label: 'Email', value: member.contactEmail, href: member.contactEmail ? `mailto:${member.contactEmail}` : undefined },
    { label: 'Phone', value: member.contactPhone, href: member.contactPhone ? `tel:${member.contactPhone}` : undefined },
    { label: 'LinkedIn', value: member.linkedinUrl, href: member.linkedinUrl ?? undefined },
    { label: 'Website', value: member.website, href: member.website ?? undefined },
  ];
  const hasAny = rows.some((r) => r.value);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-title text-ink">Contact Information</h2>
        <div className="flex items-center gap-2">
          <SectionBadge status={getSectionEditBadge('contact', edits)} />
          {isOwnProfile && (
            <button type="button" onClick={() => onEdit('contact')} className="text-xs font-medium text-accent">
              Edit
            </button>
          )}
        </div>
      </div>
      {!hasAny ? (
        <p className="mt-2 text-sm text-ink-3">No contact details listed yet.</p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          {rows
            .filter((r) => r.value)
            .map((r) => (
              <div key={r.label} className="rounded-xl border border-line p-4">
                <dt className="text-xs text-ink-3">{r.label}</dt>
                <dd className="mt-1 truncate text-sm font-medium text-ink">
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-accent">
                      {r.value}
                    </a>
                  ) : (
                    r.value
                  )}
                </dd>
              </div>
            ))}
        </dl>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/members/tabs/AboutTab.tsx apps/frontend/components/members/tabs/ContactTab.tsx
git commit -m "feat(members): add About and Contact profile tabs"
```

---

## Task 14: `CredentialsTab` and `ReviewsTab`

**Files:**
- Create: `apps/frontend/components/members/tabs/CredentialsTab.tsx`
- Create: `apps/frontend/components/members/tabs/ReviewsTab.tsx`

**Interfaces:**
- Consumes: `MemberDto` (`@shared/member`), `Badge` (`@/components/ui`). (No `SectionBadge` for
  Credentials per §4.3/Task 3's `NO_BADGE_SECTIONS` — this tab intentionally never calls
  `getSectionEditBadge`.)
- Produces (used by Task 16): `CredentialsTab`, props
  `{ member: MemberDto; isOwnProfile: boolean;
  onEdit: (section: 'education' | 'work_experiences') => void }`;
  `ReviewsTab`, props `{ member: MemberDto; edits: MemberProfileEditDto[]; isOwnProfile: boolean;
  onEdit: (section: 'testimonials' | 'awards') => void }`.

- [ ] **Step 1: Write `components/members/tabs/CredentialsTab.tsx`**

```typescript
import type { MemberDto } from '@shared/member';

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-medium text-accent">
      Edit
    </button>
  );
}

export function CredentialsTab({
  member,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onEdit: (section: 'education' | 'work_experiences') => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Education</h2>
          {isOwnProfile && <EditButton onClick={() => onEdit('education')} />}
        </div>
        {member.educations.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No education listed yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            {member.educations.map((edu) => (
              <div key={edu.id} className="rounded-xl border border-line p-4">
                <div className="font-medium text-ink">{edu.degree}</div>
                <div className="text-sm text-ink-3">
                  {edu.institution}
                  {edu.endYear ? ` · ${edu.endYear}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Work Experience</h2>
          {isOwnProfile && <EditButton onClick={() => onEdit('work_experiences')} />}
        </div>
        {member.workExperiences.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No work experience listed yet.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-4 border-l border-line pl-5">
            {member.workExperiences.map((work) => (
              <li key={work.id}>
                <div className="font-medium text-ink">{work.title}</div>
                <div className="text-sm text-ink-3">
                  {work.company} · {work.startYear}–{work.isCurrent ? 'Present' : work.endYear}
                </div>
                {work.description && <p className="mt-1 text-sm text-ink-3">{work.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/members/tabs/ReviewsTab.tsx`**

```typescript
import { Badge } from '@/components/ui';
import { SectionBadge } from '@/components/members/SectionBadge';
import { getSectionEditBadge } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

export function ReviewsTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'testimonials' | 'awards') => void;
}) {
  const isEmpty = member.testimonials.length === 0 && member.awards.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-ink-3">No testimonials or awards yet.</p>
        {isOwnProfile && (
          <button type="button" onClick={() => onEdit('testimonials')} className="text-sm font-medium text-accent">
            Add a testimonial
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Client Testimonials</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('testimonials', edits)} />
            {isOwnProfile && (
              <button type="button" onClick={() => onEdit('testimonials')} className="text-xs font-medium text-accent">
                Edit
              </button>
            )}
          </div>
        </div>
        {member.testimonials.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No testimonials yet.</p>
        ) : (
          <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
            {member.testimonials.map((t) => (
              <div key={t.id} className="w-80 shrink-0 rounded-xl border border-line p-4">
                {t.isVerified && <Badge variant="brand">Verified</Badge>}
                <p className="mt-2 text-sm italic text-ink-2">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-2 text-xs font-medium text-ink">{t.clientName}</p>
                <p className="text-xs text-ink-3">
                  {[t.clientTitle, t.clientCompany].filter(Boolean).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Awards &amp; Recognition</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('awards', edits)} />
            {isOwnProfile && (
              <button type="button" onClick={() => onEdit('awards')} className="text-xs font-medium text-accent">
                Edit
              </button>
            )}
          </div>
        </div>
        {member.awards.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No awards yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            {member.awards.map((award) => (
              <div key={award.id} className="rounded-xl border border-line p-4">
                <div className="font-medium text-ink">{award.title}</div>
                <div className="text-sm text-ink-3">
                  {[award.issuingBody, award.year].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/members/tabs/CredentialsTab.tsx apps/frontend/components/members/tabs/ReviewsTab.tsx
git commit -m "feat(members): add Credentials and Reviews profile tabs"
```

---

## Task 15: `ArticlesTab`

**Files:**
- Create: `apps/frontend/components/members/tabs/ArticlesTab.tsx`

**Interfaces:**
- Consumes: `getArticles` (`@/lib/api/articles`, Task 2), `ApiError` (`@/lib/api/client`),
  `ArticleListItemDto` (`@shared/article`).
- Produces (used by Task 16): `ArticlesTab`, props `{ authorId: string }`. Self-contained data
  fetch (Client Component, fetches on mount) since it's a tab that may never be opened — no reason
  for the page's initial SSR to pay for it.

- [ ] **Step 1: Write `components/members/tabs/ArticlesTab.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getArticles } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import type { ArticleListItemDto } from '@shared/article';

export function ArticlesTab({ authorId }: { authorId: string }) {
  const [articles, setArticles] = useState<ArticleListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getArticles({ authorId })
      .then((result) => {
        if (!cancelled) setArticles(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load articles.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authorId]);

  if (error) {
    return <p className="py-8 text-sm text-ink-3">Couldn&apos;t load articles right now.</p>;
  }

  if (articles === null) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-alt" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return <p className="py-8 text-sm text-ink-3">No published articles yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {articles.map((article) => (
        <li key={article.id} className="rounded-xl border border-line p-4">
          <div className="font-medium text-ink">{article.title}</div>
          <p className="mt-1 text-sm text-ink-3">{article.excerpt}</p>
          <div className="mt-2 text-xs text-ink-3">{article.readTimeMinutes} min read</div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/members/tabs/ArticlesTab.tsx
git commit -m "feat(members): add Articles profile tab"
```

---

## Task 16: `ProfileTabs`

**Files:**
- Create: `apps/frontend/components/members/ProfileTabs.tsx`

**Interfaces:**
- Consumes: `MemberDto`, `MemberProfileEditDto`, `MemberEditSection` (`@shared/member`),
  `AboutTab`/`CredentialsTab`/`ArticlesTab`/`ReviewsTab`/`ContactTab` (Tasks 13, 14, 15).
- Produces (used by Task 17): `ProfileTabs`, props `{ member: MemberDto; edits:
  MemberProfileEditDto[]; isOwnProfile: boolean; onEdit: (section: MemberEditSection) => void }`.
  `onEdit` is passed straight through from the page — Task 19's modal owns the actual editing
  state, this component only routes the click.

- [ ] **Step 1: Write `components/members/ProfileTabs.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { AboutTab } from '@/components/members/tabs/AboutTab';
import { CredentialsTab } from '@/components/members/tabs/CredentialsTab';
import { ArticlesTab } from '@/components/members/tabs/ArticlesTab';
import { ReviewsTab } from '@/components/members/tabs/ReviewsTab';
import { ContactTab } from '@/components/members/tabs/ContactTab';
import type { MemberDto, MemberEditSection, MemberProfileEditDto } from '@shared/member';

const TABS = ['About', 'Credentials', 'Articles', 'Reviews', 'Contact'] as const;
type Tab = (typeof TABS)[number];

export function ProfileTabs({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: MemberEditSection) => void;
}) {
  const [active, setActive] = useState<Tab>('About');

  return (
    <div>
      <div className="flex gap-1 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`px-4 py-3 text-sm font-medium ${
              active === tab
                ? 'border-b-2 border-ink text-ink'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {active === 'About' && (
          <AboutTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Credentials' && (
          <CredentialsTab member={member} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Articles' && <ArticlesTab authorId={member.id} />}
        {active === 'Reviews' && (
          <ReviewsTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
        {active === 'Contact' && (
          <ContactTab member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/members/ProfileTabs.tsx
git commit -m "feat(members): add ProfileTabs"
```

---

## Task 17: `/members/[id]` profile page (read-only wiring, no edit modal yet)

**Files:**
- Create: `apps/frontend/app/(shell)/members/[id]/page.tsx`
- Create: `apps/frontend/app/(shell)/members/[id]/ProfileClient.tsx`

**Interfaces:**
- Consumes: `getSessionUser` (`@/lib/auth/session-claims`), `getMemberServer`/
  `getMyMemberEditsServer` (Task 1), `ProfileAuthWall` (Task 11), `ProfileHeader`/
  `ProfileSidebar`/`MobileCtaBar` (Task 12), `ProfileTabs` (Task 16), `notFound` (`next/navigation`).
- Produces: the `/members/[id]` route. `ProfileClient` is a thin Client Component boundary that
  will own `SectionEditModal` state once Task 19 lands — introduced now so Task 19 only has to
  add to it, not restructure the page.

- [ ] **Step 1: Write `app/(shell)/members/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMemberServer, getMyMemberEditsServer } from '@/lib/api/server';
import { ProfileAuthWall } from '@/components/members/ProfileAuthWall';
import { ProfileClient } from './ProfileClient';

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return <ProfileAuthWall />;
  }

  const member = await getMemberServer(params.id);
  if (!member) {
    notFound();
  }

  const isOwnProfile = sessionUser.id === member.id;
  const edits = isOwnProfile ? await getMyMemberEditsServer(member.id) : [];

  return <ProfileClient member={member} edits={edits} isOwnProfile={isOwnProfile} />;
}
```

- [ ] **Step 2: Write `app/(shell)/members/[id]/ProfileClient.tsx`**

```typescript
'use client';

import { ProfileHeader } from '@/components/members/ProfileHeader';
import { ProfileSidebar } from '@/components/members/ProfileSidebar';
import { ProfileTabs } from '@/components/members/ProfileTabs';
import { MobileCtaBar } from '@/components/members/MobileCtaBar';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

export function ProfileClient({
  member,
  edits,
  isOwnProfile,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
}) {
  // Task 19 replaces this no-op with real modal state
  // (useState<MemberEditSection | null>) and renders <SectionEditModal>
  // alongside ProfileTabs below.
  function onEdit() {}

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 pb-24 max-[640px]:px-4 min-[1024px]:pb-10">
      <ProfileHeader member={member} />
      <div className="mt-10 grid grid-cols-[1fr_320px] gap-10 max-[1023px]:grid-cols-1">
        <ProfileTabs member={member} edits={edits} isOwnProfile={isOwnProfile} onEdit={onEdit} />
        <ProfileSidebar member={member} isOwnProfile={isOwnProfile} />
      </div>
      <MobileCtaBar member={member} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

With `pnpm --filter ./apps/frontend dev` running and signed out:
- Visit `/members/<any-id>` → auth wall renders, "Sign In" / "Apply for membership" buttons work.

Signed in as a seeded member/client (use a real id from `/members`):
- Full profile renders: header, tabs (all 5 switch correctly), sidebar. `Edit` buttons are visible
  only when viewing your own profile (they no-op for now — Task 19 wires them).
- 375px: header stacks, tabs scroll horizontally if needed, mobile CTA bar fixed at the bottom,
  sidebar stacks below tabs.
- 1440px: two-column layout, sidebar on the right, no mobile CTA bar.
- Visit a nonexistent id → Next.js 404 page.

Expected: no console errors, layout matches at both widths.

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/app/(shell)/members/[id]/page.tsx" "apps/frontend/app/(shell)/members/[id]/ProfileClient.tsx"
git commit -m "feat(members): add /members/[id] profile page (read-only)"
```

---

## Task 18: Self-edit section field config

**Files:**
- Create: `apps/frontend/components/members/edit/sectionFieldConfig.ts`

**Interfaces:**
- Consumes: all per-section payload types from `@shared/member`
  (`HeadlineBioEditPayload`, `ContactEditPayload`, `EngagementsEditPayload`,
  `EducationEditPayload`, `WorkExperiencesEditPayload`, `KeyClientsEditPayload`,
  `TestimonialsEditPayload`, `AwardsEditPayload`, `MemberEditSection`).
- Produces (used by Task 19): `SECTION_CONFIG: Record<MemberEditSection, SectionConfig>`,
  `SECTION_TITLES: Record<MemberEditSection, string>`, and per-section empty-row factories
  (`emptyEngagementRow()`, etc.) plus the `SectionConfig`/`FieldSpec` types.

- [ ] **Step 1: Write `components/members/edit/sectionFieldConfig.ts`**

```typescript
import type { MemberEditSection } from '@shared/member';

// One structured field per real payload property — the deliberate
// alternative to the prototype's single-textarea `·`-split shortcut (see
// docs/rest-api.md and the design spec §7). SectionEditModal (Task 19)
// renders one <input>/<textarea> per FieldSpec, for each row in a list
// section.
export type FieldSpec =
  | { key: string; label: string; type: 'text' | 'url' | 'email' | 'tel'; required?: boolean }
  | { key: string; label: string; type: 'textarea'; required?: boolean }
  | { key: string; label: string; type: 'number'; required?: boolean }
  | { key: string; label: string; type: 'checkbox' };

export type SectionShape =
  | 'fields' // single structured form, no proof — headline_bio, contact
  | 'list-shared-proof' // repeatable rows, one proof for the whole batch — education, work_experiences
  | 'list-per-item-proof' // repeatable rows, proof per row — engagements, testimonials, awards
  | 'clients'; // repeatable rows, per-row logo upload instead of proof — key_clients

export interface SectionConfig {
  shape: SectionShape;
  fields: FieldSpec[];
  maxItems?: number; // only meaningful for list/clients shapes
}

export const SECTION_TITLES: Record<MemberEditSection, string> = {
  headline_bio: 'Headline & Bio',
  contact: 'Contact Information',
  engagements: 'Key Engagements',
  education: 'Education',
  work_experiences: 'Work Experience',
  key_clients: 'Key Clients',
  testimonials: 'Client Testimonials',
  awards: 'Awards & Recognition',
};

export const SECTION_CONFIG: Record<MemberEditSection, SectionConfig> = {
  headline_bio: {
    shape: 'fields',
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', required: true },
      { key: 'bio', label: 'Bio', type: 'textarea', required: true },
    ],
  },
  contact: {
    shape: 'fields',
    fields: [
      { key: 'contactEmail', label: 'Email', type: 'email' },
      { key: 'contactPhone', label: 'Phone', type: 'tel' },
      { key: 'linkedinUrl', label: 'LinkedIn URL', type: 'url' },
      { key: 'website', label: 'Website', type: 'url' },
    ],
  },
  engagements: {
    shape: 'list-per-item-proof',
    maxItems: 10,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'organization', label: 'Organization', type: 'text', required: true },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'url', label: 'URL', type: 'url' },
    ],
  },
  education: {
    shape: 'list-shared-proof',
    maxItems: 5,
    fields: [
      { key: 'degree', label: 'Degree', type: 'text', required: true },
      { key: 'institution', label: 'Institution', type: 'text', required: true },
      { key: 'field', label: 'Field of study', type: 'text' },
      { key: 'endYear', label: 'End year', type: 'number' },
    ],
  },
  work_experiences: {
    shape: 'list-shared-proof',
    maxItems: 10,
    fields: [
      { key: 'title', label: 'Job title', type: 'text', required: true },
      { key: 'company', label: 'Company', type: 'text', required: true },
      { key: 'startYear', label: 'Start year', type: 'number', required: true },
      { key: 'endYear', label: 'End year', type: 'number' },
      { key: 'isCurrent', label: 'I currently work here', type: 'checkbox' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  key_clients: {
    shape: 'clients',
    maxItems: 12,
    fields: [{ key: 'name', label: 'Client name', type: 'text', required: true }],
  },
  testimonials: {
    shape: 'list-per-item-proof',
    maxItems: 10,
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea', required: true },
      { key: 'clientName', label: 'Client name', type: 'text', required: true },
      { key: 'clientTitle', label: 'Client title', type: 'text' },
      { key: 'clientCompany', label: 'Client company', type: 'text' },
      { key: 'serviceName', label: 'Service', type: 'text' },
      { key: 'occurredOn', label: 'Date (YYYY-MM-DD)', type: 'text' },
    ],
  },
  awards: {
    shape: 'list-per-item-proof',
    maxItems: 10,
    fields: [
      { key: 'title', label: 'Award title', type: 'text', required: true },
      { key: 'issuingBody', label: 'Issuing body', type: 'text' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
};

// Empty-row factories — one per list/clients section, used by "+ Add
// another" in SectionEditModal. Kept here (not inlined) so their shape stays
// next to the FieldSpec list it must match.
export const EMPTY_ROW: Record<string, Record<string, unknown>> = {
  engagements: { title: '', organization: '', year: undefined, url: '' },
  education: { degree: '', institution: '', field: '', endYear: undefined },
  work_experiences: {
    title: '',
    company: '',
    startYear: undefined,
    endYear: undefined,
    isCurrent: false,
    description: '',
  },
  key_clients: { name: '', logoUrl: null, logoUploadPath: undefined },
  testimonials: {
    quote: '',
    clientName: '',
    clientTitle: '',
    clientCompany: '',
    serviceName: '',
    occurredOn: '',
  },
  awards: { title: '', issuingBody: '', year: undefined, description: '' },
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/members/edit/sectionFieldConfig.ts
git commit -m "feat(members): add self-edit section field config"
```

---

## Task 19: `SectionEditModal` and edit-button wiring

**Files:**
- Create: `apps/frontend/components/members/edit/SectionEditModal.tsx`
- Modify: `apps/frontend/app/(shell)/members/[id]/ProfileClient.tsx`

**Interfaces:**
- Consumes: `Modal`, `Input`, `Textarea`, `Button` (`@/components/ui`), `SECTION_CONFIG`/
  `SECTION_TITLES`/`EMPTY_ROW`/`FieldSpec` (Task 18), `createMemberEdit`/`requestMemberUpload`
  (`@/lib/api/members`), `uploadToSignedUrl` (`@/lib/api/upload`), `ApiError`
  (`@/lib/api/client`), `MemberDto`, `MemberEditSection`, `CreateMemberEditRequest`
  (`@shared/member`).
- Produces: `SectionEditModal`, props `{ member: MemberDto; section: MemberEditSection | null;
  onClose: () => void; onSubmitted: () => void }`. `ProfileClient` now holds real
  `useState<MemberEditSection | null>` for `onEdit`/modal visibility.

- [ ] **Step 1: Write `components/members/edit/SectionEditModal.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Modal, Input, Textarea, Button } from '@/components/ui';
import {
  EMPTY_ROW,
  SECTION_CONFIG,
  SECTION_TITLES,
  type FieldSpec,
} from '@/components/members/edit/sectionFieldConfig';
import { createMemberEdit, requestMemberUpload } from '@/lib/api/members';
import { uploadToSignedUrl } from '@/lib/api/upload';
import { ApiError } from '@/lib/api/client';
import type { CreateMemberEditRequest, MemberDto, MemberEditSection } from '@shared/member';

type Row = Record<string, unknown>;

function initialPayload(member: MemberDto, section: MemberEditSection): Row | Row[] {
  switch (section) {
    case 'headline_bio':
      return { headline: member.headline ?? '', bio: member.bio ?? '' };
    case 'contact':
      return {
        contactEmail: member.contactEmail ?? '',
        contactPhone: member.contactPhone ?? '',
        linkedinUrl: member.linkedinUrl ?? '',
        website: member.website ?? '',
      };
    case 'engagements':
      return member.engagements.length
        ? member.engagements.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.engagements }];
    case 'education':
      return member.educations.length
        ? member.educations.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.education }];
    case 'work_experiences':
      return member.workExperiences.length
        ? member.workExperiences.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.work_experiences }];
    case 'key_clients':
      // logoUrl is carried through unchanged unless a new file is uploaded
      // (see the 'clients'-shape logo input below) — edits replace the
      // section wholesale, so dropping it here would silently wipe an
      // existing client's logo even if the member only meant to add another.
      return member.keyClients.length
        ? member.keyClients.map((c) => ({ name: c.name, logoUrl: c.logoUrl, logoUploadPath: undefined }))
        : [{ ...EMPTY_ROW.key_clients }];
    case 'testimonials':
      return member.testimonials.length
        ? member.testimonials.map(({ id: _id, isVerified: _v, ...rest }) => rest)
        : [{ ...EMPTY_ROW.testimonials }];
    case 'awards':
      return member.awards.length
        ? member.awards.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.awards }];
  }
}

function Field({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (spec.type === 'textarea') {
    return (
      <Textarea
        label={spec.label}
        required={spec.required}
        rows={3}
        maxLength={2000}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (spec.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {spec.label}
      </label>
    );
  }
  if (spec.type === 'number') {
    return (
      <Input
        label={spec.label}
        type="number"
        required={spec.required}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    );
  }
  return (
    <Input
      label={spec.label}
      type={spec.type}
      required={spec.required}
      maxLength={300}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SectionEditModal({
  member,
  section,
  onClose,
  onSubmitted,
}: {
  member: MemberDto;
  section: MemberEditSection | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [data, setData] = useState<Row | Row[] | null>(null);
  const [proofMode, setProofMode] = useState<'file' | 'link'>('link');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofLink, setProofLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state whenever a new section is opened.
  const [openedSection, setOpenedSection] = useState<MemberEditSection | null>(null);
  if (section && section !== openedSection) {
    setOpenedSection(section);
    setData(initialPayload(member, section));
    setProofMode('link');
    setProofFile(null);
    setProofLink('');
    setError(null);
  }

  if (!section || data === null) return null;

  const config = SECTION_CONFIG[section];
  const needsProof = config.shape === 'list-per-item-proof' || config.shape === 'list-shared-proof';
  const rows = Array.isArray(data) ? data : null;

  function updateField(rowIndex: number | null, key: string, value: unknown) {
    if (rowIndex === null) {
      setData((prev) => ({ ...(prev as Row), [key]: value }));
    } else {
      setData((prev) => {
        const next = [...(prev as Row[])];
        next[rowIndex] = { ...next[rowIndex], [key]: value };
        return next;
      });
    }
  }

  function addRow() {
    if (!rows) return;
    setData([...rows, { ...EMPTY_ROW[section] }]);
  }

  function removeRow(index: number) {
    if (!rows) return;
    setData(rows.filter((_, i) => i !== index));
  }

  const proofSatisfied = !needsProof || Boolean(proofFile) || proofLink.trim().length > 0;
  const canSubmit = proofSatisfied && !submitting;

  // 'clients' shape uploads a logo per-row, immediately on file select (not
  // deferred to submit like proof files) — each row's logoUploadPath is set
  // as soon as its own upload finishes, independent of the other rows.
  async function handleLogoUpload(rowIndex: number, file: File) {
    setError(null);
    try {
      const { uploadUrl, path } = await requestMemberUpload(member.id, {
        fileName: file.name,
        contentType: file.type,
      });
      await uploadToSignedUrl(uploadUrl, file);
      updateField(rowIndex, 'logoUploadPath', path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Logo upload failed. Please try again.');
    }
  }

  async function handleSubmit() {
    if (!section) return;
    setSubmitting(true);
    setError(null);
    try {
      let proofFileUrl: string | undefined;
      if (proofMode === 'file' && proofFile) {
        const { uploadUrl, path } = await requestMemberUpload(member.id, {
          fileName: proofFile.name,
          contentType: proofFile.type,
        });
        await uploadToSignedUrl(uploadUrl, proofFile);
        proofFileUrl = path;
      }

      const body = {
        section,
        payload: data,
        ...(needsProof
          ? { proofFileUrl, proofLink: proofMode === 'link' ? proofLink.trim() || undefined : undefined }
          : {}),
      } as CreateMemberEditRequest;

      await createMemberEdit(member.id, body);
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={SECTION_TITLES[section]}>
      <div className="flex flex-col gap-4">
        {rows ? (
          <>
            {rows.map((row, i) => (
              <div key={i} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-mono-label text-ink-3">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-xs font-medium text-error"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {config.fields.map((spec) => (
                    <Field
                      key={spec.key}
                      spec={spec}
                      value={row[spec.key]}
                      onChange={(value) => updateField(i, spec.key, value)}
                    />
                  ))}
                </div>
                {config.shape === 'clients' && (
                  <div className="mt-3">
                    {typeof row.logoUrl === 'string' && !row.logoUploadPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logoUrl} alt="" className="mb-2 h-8 object-contain" />
                    )}
                    <label className="text-xs font-medium text-ink-2">Logo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(i, file);
                      }}
                      className="mt-1 block text-sm"
                    />
                    {row.logoUploadPath ? (
                      <p className="mt-1 text-xs text-ok">New logo uploaded.</p>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            {rows.length < (config.maxItems ?? Infinity) && (
              <button
                type="button"
                onClick={addRow}
                className="rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
              >
                + Add another
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {config.fields.map((spec) => (
              <Field
                key={spec.key}
                spec={spec}
                value={(data as Row)[spec.key]}
                onChange={(value) => updateField(null, spec.key, value)}
              />
            ))}
          </div>
        )}

        {needsProof && (
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-ink-2">Proof</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setProofMode('file')}
                className={`rounded-full px-3 py-1 text-xs font-medium ${proofMode === 'file' ? 'bg-ink text-bg' : 'bg-bg-alt text-ink-2'}`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setProofMode('link')}
                className={`rounded-full px-3 py-1 text-xs font-medium ${proofMode === 'link' ? 'bg-ink text-bg' : 'bg-bg-alt text-ink-2'}`}
              >
                Paste link
              </button>
            </div>
            {proofMode === 'file' ? (
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="mt-3 text-sm"
              />
            ) : (
              <input
                type="text"
                placeholder="https://…"
                value={proofLink}
                onChange={(e) => setProofLink(e.target.value)}
                className="mt-3 w-full rounded-input border border-line px-3 py-2 text-sm outline-none focus:border-ink"
              />
            )}
            {!proofSatisfied && (
              <p className="mt-2 text-xs text-error">
                Please attach a file or a link as proof before submitting.
              </p>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-input border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!canSubmit} fullWidth>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire the modal into `app/(shell)/members/[id]/ProfileClient.tsx`**

Replace the file's contents with:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileHeader } from '@/components/members/ProfileHeader';
import { ProfileSidebar } from '@/components/members/ProfileSidebar';
import { ProfileTabs } from '@/components/members/ProfileTabs';
import { MobileCtaBar } from '@/components/members/MobileCtaBar';
import { SectionEditModal } from '@/components/members/edit/SectionEditModal';
import type { MemberDto, MemberEditSection, MemberProfileEditDto } from '@shared/member';

export function ProfileClient({
  member,
  edits,
  isOwnProfile,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
}) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<MemberEditSection | null>(null);

  function handleSubmitted() {
    // Re-fetch the Server Component so the new pending edit's badge shows
    // up immediately, same pattern as any other server-data mutation here.
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 pb-24 max-[640px]:px-4 min-[1024px]:pb-10">
      <ProfileHeader member={member} />
      <div className="mt-10 grid grid-cols-[1fr_320px] gap-10 max-[1023px]:grid-cols-1">
        <ProfileTabs
          member={member}
          edits={edits}
          isOwnProfile={isOwnProfile}
          onEdit={setEditingSection}
        />
        <ProfileSidebar member={member} isOwnProfile={isOwnProfile} />
      </div>
      <MobileCtaBar member={member} />
      <SectionEditModal
        member={member}
        section={editingSection}
        onClose={() => setEditingSection(null)}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/frontend typecheck`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Signed in, viewing your own profile:
- Click "Edit" on Headline & Bio → modal opens pre-filled, no proof section. Change the headline,
  submit → modal closes, page refreshes, "Pending verification" badge appears next to Headline &
  Bio.
- Click "Edit" on Key Engagements → modal opens with structured rows (not one textarea), proof
  section visible. Try submitting with no file/link → inline error, submit stays disabled/blocked.
  Paste a link, submit → succeeds, badge appears.
- Click "+ Add another" on a list section → new blank row appears; "Remove" removes a row (hidden
  when only one row remains).
- Confirm Credentials tab's Education/Work Experience edit buttons work but show **no** pending
  badge after submitting (per the deliberate no-badge sections).
- Click "Edit" on Key Clients → per-row logo file input appears (not a proof section). Uploading a
  logo shows "New logo uploaded."; submitting with an existing client's logo untouched preserves
  it (doesn't null it out) — verify via `GET /v1/members/:id/edits` payload or re-opening the
  modal after admin approval if that's feasible to check locally.
- 375px: modal fits within viewport, scrolls internally if content overflows, doesn't break page
  layout underneath.

Expected: no console errors; a genuinely new `member_profile_edits` row is created (verify via the
existing `GET /v1/members/:id/edits` response or a DB check if available).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/members/edit/SectionEditModal.tsx "apps/frontend/app/(shell)/members/[id]/ProfileClient.tsx"
git commit -m "feat(members): wire self-edit SectionEditModal into profile page"
```

---

## Task 20: `docs/design-system.md` updates

**Files:**
- Modify: `docs/design-system.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks — this is the spec's §9 obligation, done last so the
  components it documents already exist.

- [ ] **Step 1: Add `FilterPopover` and `Modal` to the Components table**

Find the `## Components` table (`| Component | Use for | Notes |`) and add two rows following the
existing table's format (check the exact existing row style before matching it verbatim):

```markdown
| `FilterPopover` | Multi/single-select filter control with optional in-list search (directory filters) | `components/ui/FilterPopover.tsx` — native `<select>` (see `Select`) can't do multi-select or in-list search |
| `Modal` | Centered dialog overlay (e.g. the member self-edit forms) | `components/ui/Modal.tsx` — closes on Escape/backdrop click, locks body scroll while open |
```

- [ ] **Step 2: Add a note on the pending-edit amber color, under "Color combination rules"**

```markdown
- **Pending/in-review indicator** (e.g. a member profile section awaiting admin verification):
  Tailwind's default `amber-50`/`amber-700` pair, used directly (not a `--`-prefixed token) —
  first and, as of this addition, only call site (`components/members/SectionBadge.tsx`).
  Promote to a real CSS-variable token if a second call site ever needs it.
```

- [ ] **Step 3: Commit**

```bash
git add docs/design-system.md
git commit -m "docs(design-system): document FilterPopover, Modal, pending-amber color"
```

---

## Self-Review Notes (recorded, not a task)

- **Spec coverage:** §4 (shell) → Task 6; §5 (directory) → Tasks 7–10; §6 (profile read view) →
  Tasks 11–17; §7 (self-edit) → Tasks 18–19; §9 (design-system updates) → Task 20. §8's
  loading/error/empty table is covered inline within the tasks that own each surface (skeletons in
  Task 9/15, `error.tsx` in Task 10, modal error banner in Task 19) rather than a separate task,
  since none of those states are separable deliverables on their own.
- **Type consistency checked:** `MemberFilters`/`GetMembersParams` (Task 2) used identically by
  Tasks 8, 9, 10. `MemberEditSection` union used identically across Tasks 13/14/16/18/19.
  `isOwnProfile: boolean` prop name/type consistent across Tasks 12, 16, 17. `SectionConfig`/
  `FieldSpec` (Task 18) consumed as defined by Task 19, no renamed fields.
- **No placeholders:** every step above has literal, complete code — none deferred to "similar to
  Task N" or left as a TODO.
