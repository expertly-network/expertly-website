# Consultations — Backend Design Spec

**Status:** Approved — superseded in two small places by what actually shipped, kept here as the
historical record rather than rewritten: §2's "no such UUID" case returns `400`, not the `404`
mentioned there, and §2's "rolling D-day window" phrase should have read "fixed window" to match
§4, which was always correct. Current contract: `docs/rest-api.md`'s Consultations section.

**Scope:** Backend only, this session — schema, REST contract, shared types, NestJS module,
verified without a frontend. Per root `CLAUDE.md`'s backend/frontend session split. Frontend
(`consultation-requests.html` → member inbox, `my-consultations.html` → requester's sent list, the
request modal embedded in `member-profile.html`) is a separate follow-up session against this now-
fixed contract.

## 1. Current state

- `consultation_requests` table already exists (`supabase/migrations/0004_tables.sql:551`),
  created ahead of any API work, per `master-tdd.md`'s warning not to assume "table exists" means
  "feature built." Columns: `id, requester_id, member_id, service_id, custom_service_label,
  subject, message, description, status, scheduled_at, response_message, created_at, updated_at`.
  RLS: `consultation_requests_select_requester` / `_select_member` already exist (defense-in-depth
  only — the backend uses the service-role client and enforces scoping itself).
- `consultation_status` enum already exists (`0002_enums.sql:44`): `'pending' | 'completed' |
  'declined'`.
- No backend module, no REST endpoints, no shared types, no `docs/database-erd.md` /
  `docs/rest-api.md` section for this resource yet.
- `admin-permissions.ts`'s `manageConsultations` permission already exists in the `AdminPermission`
  union and `super_admin`'s permission set, but nothing checks it yet (same ahead-of-schedule
  pattern as the table).
- `docs/roadmap.md`'s "Consultations" section sketches a simpler shape (`name, email, phone,
  message` only) than the live migration schema. Validated against the actual prototype pages
  below — the richer schema columns (`service_id`, `subject`, `description`, `scheduled_at`,
  `response_message`) have no corresponding UI in the request-creation modal and are **not** wired
  up by this spec (see §3).
- Established precedent this spec follows: `EventsModule`'s repository/service/controller split
  (`EventsRepository` owns Supabase access + column aliasing, `EventsService` holds business
  logic, controllers stay thin) and `AdminEventsController`'s `@Roles('admin')` +
  `@RequiresPermission(...)` gating. `MembersRepository.findProfilesByIds()` (batched `profiles`
  lookup returning a `Map`) is reused rather than re-implemented — this codebase does not use
  Supabase nested-select joins, display data for a different table is always a separate batched
  query stitched together in the service layer.

## 2. Validated against the prototype

**`member-profile.html`'s request modal** ("Send a Message" panel): collects `name`, `email`
(validated client-side with a simple regex), `phone`, `message` (max 2000 chars) — all four
required. No topic/service picker. A "Schedule a Call" tab exists but is explicitly "pilot member
only" and routes to VC scheduling + AI transcription — that's Peer Connect-shaped, not this
feature; `master-tdd.md` recommends Peer Connect get its own scoping session. **Not built here.**

**`consultation-requests.html`** (member's received-requests inbox): stat tiles (total/pending/
completed/declined), filter tabs, search by name/firm, per-card mailto/tel actions, Complete/
Decline buttons on pending requests only, CSV transcript download (client-side, needs no new
endpoint — it already has the full list in memory). **The prototype has no ownership filter at
all** (shows every request in the admin-data.js store to every member) — explicitly not
reproduced; the real `received` endpoint scopes to `member_id = caller.id`.

**`my-consultations.html`** (requester's sent-requests list): same stat/filter/search shell,
redirects a `member`-role session to the inbox page instead of showing it (two pages for two
roles viewing the same underlying resource, confirmed by `roadmap.md`'s read of `admin-data.js`'s
own comment).

**Resolved open questions** (per this session's brainstorming):
- Client→member only vs. member→member: **both** — any signed-up user (`client` or `member`
  role) can send a request. The prototype's `requesterFirm`/verified-badge treatment is cosmetic
  seed data, never actually produced by the real creation flow — the backend computes it for real
  by joining `requester_id` → `profiles.role` / `member_profiles.firm_name`, not from client input.
- Rate limit (new requirement, not in the prototype): max `N` requests per rolling `D`-day window,
  both configurable via env vars, window boundaries fixed at 08:00 UTC regardless of requester
  timezone, counts total requests across all target members (not per-member).

## 3. Explicitly deferred (named, not silently dropped)

- **`service_id` / `custom_service_label` / `subject` / `description` / `scheduled_at` /
  `response_message`** — columns stay in the schema (harmless, nullable) but are not written to
  or read by any endpoint in this spec. No topic picker, no scheduling, no admin response note in
  the current design prototype. Revisit only if a product decision adds them.
- **"Schedule a Call" / Peer Connect-style scheduling** — out of scope, own session per
  `master-tdd.md`.
- **Notifications** ("new request received", "request completed/declined") — no notification
  infrastructure exists yet (`master-tdd.md` Section 8.3, beyond-roadmap). Not added here.
- **In-app messaging** — contact always resolves to `mailto:`/`tel:`, matching the prototype.
- **Frontend** — entirely deferred to a follow-up session.
- **`memberPractice`** (shown in the prototype's inbox cards) — deriving a member's practice area
  requires the `member_services` → `services` → `categories` join chain
  (`MembersRepository.findMemberServicesByMemberIds`). Deferred from this contract to avoid
  coupling the first version to that chain; `received`/`mine` return `memberFirmName` and
  `memberHeadline` instead (both plain columns, no join chain), which the frontend session can
  decide whether to show as a practice-area substitute or request as a follow-up contract
  addition.

## 4. Rate limit

Two env vars, same pattern as `ARTICLES_REVIEW_MODE` / `AI_PROVIDER`:
- `CONSULTATION_REQUEST_LIMIT` (default `3`)
- `CONSULTATION_REQUEST_WINDOW_DAYS` (default `1`)

Window is a fixed, deterministic bucket of `WINDOW_DAYS` days anchored to 08:00 UTC against a
fixed epoch (`1970-01-01T08:00:00Z`), not a rolling clock:

```
windowMs = WINDOW_DAYS * 86_400_000
windowStart = epoch + floor((now - epoch) / windowMs) * windowMs
```

`ConsultationsService.assertUnderRateLimit(requesterId)` counts `consultation_requests` rows for
that `requester_id` with `created_at >= windowStart` (any `member_id`, any status) and throws
`HttpException('Too many consultation requests — try again later.', HttpStatus.TOO_MANY_REQUESTS)`
if the count is `>= CONSULTATION_REQUEST_LIMIT`, with `windowStart + windowMs` (the reset instant)
included in the thrown response body as `resetAt` so a future frontend can show "try again at X."

## 5. Schema change

Folded into `supabase/migrations/0004_tables.sql`'s existing `create table
public.consultation_requests` statement (pre-production four-file convention — not a new numbered
file). Three new `not null` columns, since the request-creation modal lets the requester type
contact details independent of their account profile (`requesterContactEmail` is explicitly
distinct from the session's account email in the prototype's own data model):

```sql
requester_name text not null,
requester_contact_email text not null,
requester_phone text not null,
```

Added after `member_id` so the column order roughly matches the request body shape. No backfill
needed — pre-production, table currently has zero rows (schema-only). After editing the migration,
hand-update `apps/backend/src/supabase/database.types.ts`'s `consultation_requests` `Row`/
`Insert`/`Update` shapes to match (no live DB available in this environment to run `pnpm --filter
./apps/backend gen:types`; same manual-sync approach as the rest of this session's work).

## 6. REST contract (base path `/v1`)

| Method | Path | Access | Notes |
|---|---|---|---|
| `POST` | `/consultations` | 🔑 Auth | Create. 404 `memberId` isn't a `member`-role profile, 400 self-request, 429 rate-limited |
| `GET` | `/consultations/mine` | 🔒 Owner | Caller's sent requests, newest first |
| `GET` | `/consultations/received` | 🔒 Owner | 403 unless caller's role is `member`; scoped to `member_id = caller.id` |
| `PATCH` | `/consultations/:id` | 🔒 Owner (member) | `{ status: 'completed' \| 'declined' }`. 403 if caller isn't the request's `member_id`, 409 if not currently `pending` |
| `GET` | `/admin/consultations` | 🛡️ `manageConsultations` | All requests, unpaginated (matches `AdminMembersController.listMembers()`'s precedent) |
| `PATCH` | `/admin/consultations/:id` | 🛡️ `manageConsultations` | Same transition, no ownership check |

### 6.1 DTOs

`CreateConsultationRequestDto` (class-validator): `memberId` (`@IsUUID`), `name` (`@IsString`
`@IsNotEmpty` `@MaxLength(120)`), `email` (`@IsEmail` `@MaxLength(200)`), `phone` (`@IsString`
`@IsNotEmpty` `@MaxLength(30)`), `message` (`@IsString` `@IsNotEmpty` `@MaxLength(2000)`).

`UpdateConsultationStatusDto`: `status` (`@IsIn(['completed', 'declined'])`).

### 6.2 Service (`ConsultationsService`)

- `create(requester: AuthenticatedUser, dto: CreateConsultationRequestDto): Promise<ConsultationRequestDto>`
  — looks up `dto.memberId` via `profiles`, 404s if missing or `role !== 'member'`, 400s if
  `dto.memberId === requester.id`, calls `assertUnderRateLimit(requester.id)`, inserts.
- `findMine(requesterId: string): Promise<ConsultationRequestDto[]>` — rows where
  `requester_id = requesterId`, newest first; enriches each with `memberFirmName`/`memberHeadline`/
  `memberAvatarUrl` via a batched `profiles` + `member_profiles` lookup (ids collected from the
  result set, one query each, same shape as `MembersRepository.findProfilesByIds`).
- `findReceived(member: AuthenticatedUser): Promise<ConsultationRequestDto[]>` — 403 if
  `member.role !== 'member'`; rows where `member_id = member.id`, newest first; enriches each with
  `requesterIsVerifiedMember` (boolean) computed from the real `requester_id` → `profiles.role`,
  never from client input.
- `updateStatus(id: string, member: AuthenticatedUser, dto: UpdateConsultationStatusDto):
  Promise<ConsultationRequestDto>` — 404 if missing, 403 if `row.member_id !== member.id`, 409 if
  `row.status !== 'pending'`, else patches `status`.
- `adminList(): Promise<ConsultationRequestDto[]>` / `adminUpdateStatus(id, dto)` — same
  transition logic, no ownership check.

### 6.3 Shared types (`packages/shared-types/consultation-request.ts`)

`ConsultationRequestDto`, `CreateConsultationRequestRequest`, `UpdateConsultationStatusRequest` —
camelCase, re-exported from `index.ts`, matching the README's own named example for this file.

### 6.4 Docs updates required (part of this implementation)

- `docs/rest-api.md` — new "Consultations" section with the table above plus full request/response
  shapes, mirroring the Events section's format.
- `docs/database-erd.md` — new "Consultations" section documenting the table (including the 3 new
  columns) and the design decisions in §2/§3 above (the roadmap-vs-schema mismatch, the
  deliberately-unused columns, the ownership-filter fix).
- `packages/shared-types/consultation-request.ts` — new file, per §6.3.

## 7. Error handling

Standard NestJS HTTP exceptions with descriptive messages — `NotFoundException` (404),
`ForbiddenException` (403), `ConflictException` (409, not-pending transition),
`BadRequestException` (400, self-request), and a plain `HttpException(..., HttpStatus.
TOO_MANY_REQUESTS)` (429) for the rate limit — same shape as `ApplicationsService`'s existing
exception usage, no new error-code scheme introduced (matches current codebase convention, not the
unused `error.code` scheme `CLAUDE.md` describes but nothing yet implements).

## 8. Verification

`pnpm typecheck` at the repo root. Manual REST-client verification (curl or Swagger `/api`) of all
6 endpoints: as `client`, as `member` (own + someone else's `received`/`:id`), as `admin`, and
unauthenticated — confirm the 200/403/404/409/429 split for each, per root `CLAUDE.md`'s
backend-session methodology. No frontend involved.
