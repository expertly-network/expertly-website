# Consultations — Frontend Design Spec

**Status:** Approved, pre-implementation.
**Scope:** Frontend, against the now-fixed, already-live backend contract (`docs/rest-api.md`'s
Consultations section) — plus one small, additive backend amendment (§5.2) discovered as a real
contract gap during this design, not a reopening of the backend session's own scope. Three
frontend pieces: the request modal (member-profile page), the member's received-requests inbox,
the requester's sent-requests page.

## 1. Current state

- Backend is fully built and live: `POST /v1/consultations`, `GET /v1/consultations/mine`,
  `GET /v1/consultations/received`, `PATCH /v1/consultations/:id`,
  `GET /v1/admin/consultations`, `PATCH /v1/admin/consultations/:id`. Types in
  `packages/shared-types/consultation-request.ts` (`ConsultationRequestDto`,
  `CreateConsultationRequestRequest`, `UpdateConsultationStatusRequest`).
- `ProfileSidebar.tsx:64` and `MobileCtaBar.tsx:18` both render a hardcoded
  `<Button disabled aria-disabled="true" title="Coming soon">Request Consultation</Button>` — no
  handler, no modal exists.
- No `/consultation-requests` or `/my-consultations` route exists yet.
  `middleware.ts:6`'s `PROTECTED_PREFIXES` comment already names `/my-consultations` as a future
  protected prefix — not yet added to the array.
- `ProfileClient.tsx` already lifts modal-open state and renders a conditional modal
  (`SectionEditModal`) this exact way — the pattern this spec's request modal follows.

## 2. Validated against the prototype (re-confirmed via live browser render this session)

- **`member-profile.html`'s "Send a Message" panel** (not the "Schedule a Call" tab — out of
  scope, Peer Connect-shaped, see the backend spec's §3): `name`, `email`, `phone`, `message`
  (max 2000, live char counter), all required, simple email regex validation, success state
  replaces the form in place.
- **`consultation-requests.html`**: hero with 4 stat tiles (Total/Pending/Completed/Declined),
  filter tabs with counts, search-by-name-or-firm, "Download transcript" (client-side CSV of the
  currently-loaded list), one card per request — avatar/initials, name, verified badge + firm
  when the requester is themselves a member, status badge, message excerpt, received date,
  mailto/tel links, Email/Call/Complete/Decline buttons (Complete/Decline only when `pending`).
- **`my-consultations.html`**: same stat/tab/search shell, no download button, card shows the
  target member's name/firm/avatar/verified-badge/practice instead, "View Profile" link instead
  of action buttons. Redirects a `member`-role session to the inbox page instead of rendering.

## 3. Explicitly deferred (named, not silently dropped)

- **"Schedule a Call"** — out of scope, matches the backend spec's deferral.
- **CSV export beyond the currently-loaded list** — client-side only, over whatever's in the
  already-fetched array, matching the prototype exactly (no pagination exists on the backend list
  endpoints either).
- **`resetAt` from a 429 response** — `apiFetch`'s `ApiError` only carries `message`/`statusCode`
  today; threading `resetAt` through would mean widening that shared error type for one caller.
  The 429's message text ("Too many consultation requests — try again later.") is shown as-is via
  the existing `ErrorBanner` pattern; no "try again at HH:MM" countdown.
- **`memberPractice`/`requesterPractice`** — the backend deliberately doesn't return this (see the
  backend spec's own §3); cards show firm/headline instead, matching what the contract actually
  provides.

## 4. Routes & role gating

```
app/(shell)/consultation-requests/page.tsx   — member's received inbox
app/(shell)/my-consultations/page.tsx         — requester's sent list
```

Both: Server Component, `getSessionUser()` gate (same pattern as
`app/(shell)/admin/applications/page.tsx`) — no session → `redirect('/login?returnTo=<path>')`.

- `/consultation-requests`: `profile.role !== 'member'` → `redirect('/my-consultations')`
  (there's no generic `/dashboard` to send them to yet, unlike the admin-applications precedent's
  now-stale `redirect('/dashboard')`).
- `/my-consultations`: `profile.role === 'member'` → `redirect('/consultation-requests')`,
  matching the prototype's own behavior exactly.

`middleware.ts`'s `PROTECTED_PREFIXES` gains both paths (the comment already anticipated
`/my-consultations`).

## 5. Components

```
components/consultations/
  RequestConsultationModal.tsx   — the form, Client
  ConsultationCard.tsx            — shared card, variant: 'received' | 'mine'
  ReceivedConsultationsList.tsx   — stats/tabs/search/actions/CSV, Client
  MyConsultationsList.tsx         — stats/tabs/search, Client
lib/api/consultations.ts          — createConsultation(), updateConsultationStatus()
lib/api/server.ts (add)           — getMyConsultationsServer(), getReceivedConsultationsServer()
```

### 5.1 `RequestConsultationModal`

Wired into `ProfileClient.tsx` exactly like `SectionEditModal`: `ProfileClient` owns
`const [requestModalOpen, setRequestModalOpen] = useState(false)`, passes
`onRequestConsultation={() => setRequestModalOpen(true)}` down to `ProfileSidebar` and
`MobileCtaBar` (confirmed: `ProfileHeader.tsx` has only Share/PDF actions, no consultation CTA at
all — only `ProfileSidebar.tsx:64` and `MobileCtaBar.tsx:18` carry the `disabled` stub this spec
replaces), and renders `<RequestConsultationModal member={member} open={requestModalOpen}
onClose={() => setRequestModalOpen(false)} />` at the bottom.

Built on `Modal`/`Input`/`Textarea`/`Button` from `components/ui`. Fields: name (prefilled from
`getSessionUser()`'s `first_name`/`last_name` if available, editable), email (prefilled from
`email`, editable), phone (no prefill — not in the session's JWT claims), message (`Textarea`,
`maxLength={2000}`, live counter). Client-side validation mirrors the prototype: all four
required, simple email format check. Submit calls `createConsultation({ memberId: member.id,
name, email, phone, message })`; on success, swaps the form for a success state (same in-modal
swap pattern `SectionEditModal` uses, not a route change); on `ApiError`, renders it via
`ErrorBanner` above the submit button, re-enables the button.

### 5.2 `ConsultationCard`

One card component, two variants, avoiding duplicating the avatar/name/badge/status/meta layout
twice:

```ts
type ConsultationCardProps =
  | { variant: 'received'; request: ConsultationRequestDto; onStatusChange: (id: string, status: 'completed' | 'declined') => void }
  | { variant: 'mine'; request: ConsultationRequestDto };
```

`received`: avatar falls back to a person-icon placeholder (no `requesterAvatarUrl`), shows a
verified badge + `requesterFirmName` when `requesterIsVerifiedMember`, shows `requesterName`
(the submitted name, not a live profile lookup) as the card title, `message` as the excerpt,
`mailto:`/`tel:` links from `requesterContactEmail`/`requesterPhone`, Email/Call links, and — only
when `status === 'pending'` — Complete/Decline buttons using the exact busy/error/local-state-
update pattern `AdminEventsList.tsx`'s `AdminEventActions` already establishes (no confirm step
needed here, unlike delete — these aren't destructive).

`mine`: avatar/title from `memberName`/`memberAvatarUrl`, firm from `memberFirmName`, a verified
badge always shown (every member is verified by definition), `message` as the excerpt, a
"View Profile" link to `/members/${request.memberSlug}`.

**Resolved contract gap (small, additive backend amendment, decided this session):** member
profile routes are slug-based (`/members/[slug]`), but `ConsultationRequestDto` only carried
`memberId` (a UUID) — insufficient to link anywhere real. Per root `CLAUDE.md`'s "flag back
explicitly, don't patch around it" rule, this is resolved by adding one new field,
`memberSlug?: string | null`, to `ConsultationRequestDto`
(`packages/shared-types/consultation-request.ts`), populated in
`ConsultationsService.enrichWithMemberInfo()` (`apps/backend/src/consultations/
consultations.service.ts`) alongside the existing `memberName`/`memberFirmName`/`memberHeadline`/
`memberAvatarUrl` fields — additive, non-breaking, no version bump (`docs/rest-api.md`'s own
rule). Requires extending `ConsultationsRepository`'s `MEMBER_FIRM_COLUMNS`/`MemberFirmRow` (which
already queries `member_profiles` for `firm_name`/`headline`) to also select `slug`. This is
Task 1 of the implementation plan — small backend addition, its own quick review, before the
frontend component tasks that depend on it.

Status badge: `pending` → `Badge variant="warning"`, `completed` → `variant="success"`,
`declined` → `variant="danger"`.

### 5.3 `ReceivedConsultationsList` / `MyConsultationsList`

Both: `'use client'`, receive `initialRequests: ConsultationRequestDto[]` as a prop (from the
Server Component page), own local `requests` state (mutated in place when a status change
succeeds, same pattern as `AdminEventsList`'s `handleDeleted`), `activeFilter` (`'all' | 'pending'
| 'completed' | 'declined'`), `searchQuery` (client-side substring match on name/firm, matching
the prototype). Stat tiles computed from the local `requests` array's counts (`useMemo`). Empty
state: "No requests match this view" / "Try a different status filter or clear the search" when
filtered-to-empty; a distinct first-time empty state ("You haven't requested a consultation yet" /
"No consultation requests yet") when the array itself is empty, matching the prototype's two
distinct empty messages.

`ReceivedConsultationsList` additionally: "Download transcript" button, client-side CSV built from
the current `requests` array (same columns as the prototype: Requester, Type, Firm, Message,
Email, Phone, Received, Status), `Blob`/`URL.createObjectURL` download — no new endpoint.

### 5.4 `lib/api/consultations.ts`

```ts
export function createConsultation(body: CreateConsultationRequestRequest): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>('/consultations', { method: 'POST', body: JSON.stringify(body) });
}

export function updateConsultationStatus(id: string, status: 'completed' | 'declined'): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>(`/consultations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
```

### 5.5 `lib/api/server.ts` additions

`getMyConsultationsServer()` / `getReceivedConsultationsServer()`, same shape as
`getMyApplicationServer()`/`getAdminApplicationsServer()`: read the session cookie, `fetch` with
the bearer token, `cache: 'no-store'`, throw `ApiError` on a non-OK response, return `[]` with no
session (matching `getAdminApplicationsServer`'s no-session behavior, since both pages already
redirect unauthenticated users before calling these — this is a defensive fallback, not the
primary gate).

## 6. Responsive (non-negotiable per `apps/frontend/CLAUDE.md`)

Checked at 375px and 1440px, not assumed:
- Stat tiles: 4-across on desktop, 2×2 grid below ~640px (same breakpoint shape
  `ProfileSidebar`'s own cards already use).
- Filter tabs + search: wrap or horizontally scroll below ~640px rather than overflowing.
- Cards: avatar/content stack vertically below ~480px if the two-column card layout
  (`MemberCard.tsx`'s `grid-cols-[156px_1fr]` → `grid-cols-1` pattern) doesn't fit; action buttons
  wrap to their own row.
- `RequestConsultationModal`: `Modal`'s existing `max-w-lg` + `p-6 max-[640px]:p-5` already
  handles this — no new breakpoint work needed there.

## 7. Error handling, loading, empty states (Code Quality Bar)

- Loading: the Server Component page fetches before render (no client-side spinner needed for
  initial load, matching `AdminApplicationsPage`'s pattern); the modal's submit button shows a
  busy label ("Sending…") and disables itself.
- Error: `ErrorBanner` in the modal for create failures (including the 429 case, message text as
  returned); `ErrorBanner` per-card for a failed Complete/Decline (matches `AdminEventActions`).
- Empty: see §5.3's two distinct empty-state messages (no data at all vs. filtered-to-nothing).

## 8. Verification

`pnpm typecheck` (frontend). Dev server (`pnpm dev`), manually: create a request as a client,
confirm it appears in `/my-consultations`; as the target member, confirm it appears in
`/consultation-requests`, Complete it, confirm the status updates in both views (re-navigate);
confirm the non-member redirect off `/consultation-requests` and the member redirect off
`/my-consultations`; confirm the unauthenticated redirect to `/login?returnTo=...`; 375px and
1440px on all three surfaces (modal, both list pages); empty states (fresh account, no requests
sent/received yet).
