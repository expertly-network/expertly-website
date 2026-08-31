# Expertly — REST API

Fixed contract, derived once per feature and implemented before any frontend work touches it — see
`CLAUDE.md`. Base path `/v1`. Additive changes (new optional field, new endpoint) don't need a
version bump; anything that changes an existing shape goes to `/v2`.

**Access levels** (matching `docs/auth.md`'s guard model):

| Badge | Meaning |
|---|---|
| 🌐 Public | No auth required (`@Public()`) |
| 🔑 Auth | Any authenticated role |
| 🔒 Owner | Auth, scoped to the caller's own resource |
| _role_ | Auth, restricted to exactly that role (see note below) |
| 🛡️ _permission_ | `admin`, further restricted to an admin sub-tier that has that permission — see "Admin sub-tier permissions" under Member Directory & Profiles |

## Live/generated API docs (Swagger)

`@nestjs/swagger` generates a live, always-current view of the actual wired-up routes/DTOs at
`/api` (JSON spec at `/api-json`) on the backend — a cross-check against this hand-authored file,
not a replacement for it (this file is the *design* contract, decided before implementation;
Swagger just reflects whatever's actually implemented right now, which can drift from this file if
they aren't both updated together).

**Deliberately left open in every environment for now**, including once deployed — see the comment
on `SwaggerModule.setup()` in `apps/backend/src/main.ts`. It doesn't expose real data (only route
names and DTO shapes), but it does hand a full map of the backend's routes to anyone with the URL.
**Future improvement**: gate it to non-production only (`process.env.NODE_ENV !== 'production'`)
once that tradeoff is worth revisiting — not done yet, a deliberate deferral, not an oversight.

## Membership applications

Backing `apps/backend/src/applications/`, `apps/backend/src/practice-areas/`. Schema:
`docs/database-erd.md`. Shared types: `packages/shared-types/membership-application.ts`,
`packages/shared-types/practice-area.ts`.

### 🌐 `GET /v1/practice-areas`

Returns active practice areas for the application wizard's service-preference dropdowns (and,
later, the member directory's filter).

**Response `200`:** `PracticeAreaDto[]` — `{ id: string, name: string, category:
'taxation'|'legal'|'finance_advisory', imageUrl: string | null }[]`. `category` backs the
pill-filter UI in the design (`onboarding_form.html`'s service-preference step) — see
`docs/database-erd.md`'s `practice_areas` section for the full mapping. `imageUrl` is
decorative-only representative art (the homepage's Practice Areas marquee) — nullable, never
blocks rendering when absent.

The wizard persists to the backend as the applicant moves through it — there is no
frontend-only-until-submit state anymore (see `docs/superpowers/specs/2026-08-23-member-application-form-design.md`
for the full design rationale). A `membership_applications` row starts as `status: 'draft'` on the
first save and is mutated in place across multiple calls until it transitions to `submitted`; from
then on it's treated as an immutable snapshot again, same as before this change.

### _client_ `POST /v1/applications/me`

Single write endpoint — **upsert**, not a pure-REST create. **Restricted to exactly
`role='client'`** — not expressed via `@Roles()`, since that decorator's ranked model (`admin`
satisfies a `member` check) is wrong here; enforced as an explicit check in
`ApplicationsService.saveOrSubmit()` instead. A `member`/`admin` token reaches this far (passes
the auth guard, passes body validation) and then gets a `403`, not a `401`/`400` — a deliberate
ordering: NestJS validates the request body before the controller method (and this role check)
ever runs, so a malformed body from a non-client caller surfaces as `400` first, not `403`.

**Behavior:**
- No application yet, or the caller's most recent one is `rejected` → creates a **new** `draft`
  row from whatever fields are sent (any subset — every field is optional). A `rejected` row is
  never reused/mutated — it stays as an untouched historical record, and re-applying starts a
  fresh row, matching `app/apply/page.tsx`'s pre-existing redirect gate (which only blocks
  `submitted`/`under_review`/`approved`, deliberately not `rejected`).
- An existing `draft` row → merges the sent fields into it (untouched fields keep their previous
  value; this is a merge, not a replace).
- An existing `submitted`/`under_review`/`approved` row → `409` — can't start a new application
  while one is pending or already succeeded. (`approved` is blocked here for defense-in-depth;
  in practice it's already unreachable, since an approved applicant's role has flipped to
  `member` and this endpoint requires `role: 'client'`.)
- `status: 'submitted'` in the body → after merging, the **merged row** (not just this call's
  body) must satisfy every requirement the old one-shot `POST /v1/applications` used to enforce
  (all identity/background/services/rates fields present, `workExperiences`/`educations`/
  `servicePreferences` non-empty, `rateMaxCents > rateMinCents`, `backgroundCheckConsent: true`,
  terms/privacy versions present) — missing/invalid fields are named in the `400` response body,
  not just a generic rejection. On success: computes `selectedTier`, `listPriceCents`,
  `discountAmountCents`, `amountDueCents`, `paymentStatus` exactly as the old endpoint did (see
  below), and transitions the row to `submitted`.
- Omitted/`'draft'` `status` → just saves progress, stays `draft`.

**Trade-off, deliberate:** this creates on first call and updates on repeat calls under one POST
URL — not strict REST idempotency. Accepted for a singleton-per-user resource; see the spec doc
for the discussion.

**Request:** `UpdateApplicationRequest` (see `packages/shared-types/membership-application.ts`) —
every field optional, plus `status?: 'draft' | 'submitted'` and `currentStep?: number` (which
wizard step to resume on, pure UX convenience, not validated).
- `servicePreferences[].practiceAreaId` is validated against a live, `is_active` `practice_areas`
  query whenever a call actually includes `servicePreferences` — the DB has no FK to catch an
  invalid id (see `docs/database-erd.md`). Not re-validated on calls that don't touch this field
  (a previously-valid, now-deactivated selection isn't retroactively rejected mid-draft).
- `selectedTier`, `listPriceCents`, `discountAmountCents`, `amountDueCents`, `paymentStatus`,
  `status` (beyond the `'draft'|'submitted'` request flag), `applicantId` are **never accepted
  from the client** — computed server-side exactly as before:
  - `selectedTier`: `yearsOfExperience > 12 → seasoned_professional`, else `budding_entrepreneur`.
  - `listPriceCents`: flat `$499/year` or `$49/month` regardless of tier.
  - `couponCode` (optional, free text) checked against a small hardcoded map — an unrecognized
    code is rejected with `400` at submit time, not silently ignored.
  - `paymentStatus` is `waived` if `amountDueCents` resolves to `0`, else `pending`.

**Response `200`:** `ApplicationDto` — the full current record (draft or submitted), including
resolved `servicePreferences[].practiceAreaName`, a freshly-signed `photoUrl` (private Storage
path, not a public URL — see the uploads endpoint below), and `documents[]`.

**Errors:** `401` no/invalid token · `403` not a client account · `409` application pending or
already approved · `400` validation failure (malformed body, invalid/inactive practice area id,
invalid coupon, `rateMax <= rateMin`, or — only when `status: 'submitted'` — incomplete required
fields, named in the message).

### 🔒 `GET /v1/applications/me`

The caller's own most recent application (draft or otherwise). Always owner-scoped by the
authenticated user's id — never accepts an id param, so there's no cross-user access surface.

**Response `200`:** `ApplicationDto`. **`404`** if the caller has no application at all yet.

### 🔒 `POST /v1/applications/me/linkedin-import`

Pure fetch-and-normalize — does **not** write to the draft. Fetches whatever profile data the
configured `LinkedInImportProvider` can produce for the given URL and returns it directly; the
frontend merges the result into its wizard state and saves it through `POST /v1/applications/me`
like any manually-entered edit, so there's exactly one write path regardless of how the data
originated. Backed by `N8nLinkedInImportProvider` when `LINKEDIN_IMPORT_WEBHOOK_URL` is configured,
falling back to the deterministic `MockLinkedInImportProvider` otherwise (e.g. local dev without
real credentials) — see `docs/superpowers/specs/2026-08-25-linkedin-import-real-provider-design.md`
for the confirmed n8n request/response contract and field-mapping rules. Request/response shape
here is unchanged either way — swapping providers was a zero-controller/DTO/frontend-change DI
rebind, as originally designed.

**Request:** `LinkedInImportRequest` — `{ linkedinUrl: string }`.
**Response `201`:** `LinkedInImportResponse` — every field optional; absent fields mean "couldn't
be extracted." (NestJS's default status for a `POST` handler with no `@HttpCode()` override —
confirmed live, not `200` as previously documented here.)

### 🔒 `POST /v1/applications/me/uploads`

`multipart/form-data`, fields `kind` (`'photo' | 'document'`) and `file`. Proxies the upload
through the backend rather than issuing a signed upload URL (unlike
`POST /v1/members/:id/uploads`) — a signed-URL flow never puts the file's bytes through the API,
so magic-byte MIME validation (root `CLAUDE.md`'s non-negotiable file-upload rule) would be
structurally impossible there. Bytes are sniffed with `file-type` against an allow-list
(`photo`: JPEG/PNG, 5MB max; `document`: JPEG/PNG/PDF, 15MB max) before being written to the
private `application-assets` Storage bucket at a deterministic path
(`members/application/{applicantId}/profile-photo.<ext>`, overwriting on re-upload; or
`document-{n}.<ext>`, appended). Only allowed while the caller has a `draft` application.

**Response `200`:** `ApplicationDto` — the updated record, `photoUrl`/`documents[].url` freshly
signed. **Errors:** `400` no draft to attach to, oversized file, or a MIME mismatch (including a
renamed file whose magic bytes don't match its extension/declared content-type).

## Membership applications — admin

### 🛡️ `manageApplications` `PATCH /v1/admin/applications/:id`

Approve or reject a `submitted`/`under_review` application. No admin UI consumes this route —
backend-only, curl-verified (see the spec doc §7: no admin-review page exists anywhere in the
design prototype to build one against; a real screen is deferred to its own future "Admin:
applications" session, same as `master-tdd.md`'s routing table already scoped it).

**Request:** `AdminApplicationReviewRequest` — `{ status: 'approved' | 'rejected', rejectionReason?:
string }` (`rejectionReason` required when rejecting).

**On approve:** provisions a `member_profiles` row (1:1 field mapping from the application row)
and one `member_services` row per `servicePreferences` entry, then flips `profiles.role` to
`'member'`, then marks the application `approved` — in that order, so a mid-sequence failure
leaves the application `submitted` (still reviewable) rather than silently `approved` with no
member actually provisioned. Not a true DB transaction — supabase-js has no multi-statement
transaction API from a service-role client.

**On reject:** stamps `reviewed_by`/`reviewed_at`/`rejection_reason` only.

**Errors:** `401`/`403` per the 🛡️ badge · `404` no such application · `409` application isn't
`submitted`/`under_review` · `400` rejecting without a `rejectionReason`.

## Membership applications — not built yet (explicitly deferred)

- Admin review **UI** — the endpoint above exists; no page consumes it yet.
- Member directory (`GET /v1/members`, `GET /v1/members/:id`) — separate future backend session.
- Real payment gateway integration — `payment_status='paid'` is modeled but unreachable.
- Real LinkedIn import — `MockLinkedInImportProvider` only; n8n integration is a future DI swap.

## Articles

Backing `apps/backend/src/articles/`. Schema: `docs/database-erd.md`. Shared types:
`packages/shared-types/article.ts`.

Every `ArticleDto`/`ArticleListItemDto` carries a `slug` — generated server-side from `title` on
`POST` (kebab-case, disambiguated with a `-2`/`-3`/... suffix on collision), never client-writable
and never regenerated on `PATCH`. Routes below still key on the real `id` (UUID), matching this
session's article detail route (`/articles/[id]`); `slug` is carried on the DTO for a future
pretty-URL pass, not wired into routing yet.

`authorPhotoUrl: string | null` — sourced from the author's `member_profiles.photo_url` (falling
back to `profiles.avatar_url`, same posture as `MembersService`'s `photoUrl`), null when neither
is set. `authorHeadline`/`authorFirmName: string | null` — sourced from `member_profiles.headline`/
`firm_name`, the "designation" line under the author's name/photo. All three are additive fields,
no version bump.

`aiSummary: string | null` — a short 3-point summary rendered as the detail page's "AI Summary"
callout (one bullet per `\n`-separated line), sourced from `articles.ai_summary`. **Not** LLM-
generated — genuinely written per article and stored directly in seed data (see
`supabase/migrations/0007_dev_seed_articles.sql`); root CLAUDE.md's "AI-assisted article
generation is deferred" still holds, this is a static field, not a model integration. Additive,
no version bump.

### 🌐 `GET /v1/articles`

The browse grid — published articles only, list shape (no `body`).

**Query params:** `authorId` (optional) — added by the Member Directory & Profiles session so a
member's profile page can list their own published articles via this endpoint rather than an
embedded/duplicated array (the prototype embeds a copy of the author's articles directly on the
profile object — not reproduced).

**Response `200`:** `ArticleListItemDto[]`, newest first.

### 🔒 `GET /v1/articles/me`

The caller's own articles, any status (`draft` included). Empty array if none — not a `404`, since
this is a list endpoint, unlike `GET /v1/applications/me`. Named `me`, not `mine`, to match that
same convention rather than inventing a second word for "the caller's own resource."

**Response `200`:** `ArticleListItemDto[]`, newest first.

### 🔑 `GET /v1/articles/:id`

Full article detail, including `body`. Requires being signed in (any role) — **a deliberate product
decision, not something the static prototype itself enforces**; see
`docs/database-erd.md`'s "Design decisions" note for the full reasoning.

If the article's `status` is `draft`, only its own author or an `admin` can read it — everyone else
gets **`404`, not `403`**, so a non-owner can't distinguish "doesn't exist" from "exists but isn't
published yet."

**Response `200`:** `ArticleDto`. **Errors:** `401` no/invalid token · `404` not found, or a draft
the caller can't see.

### `member` `POST /v1/articles`

Creates and immediately publishes an article. `@Roles('member')` — `admin` passes too via
`RolesGuard`'s ranked model (admin rank ≥ member rank); `client` is rejected. Unlike
`POST /v1/applications`, this doesn't need an exact-role check — "member or admin" fits the ranked
model directly.

**Request:** `CreateArticleRequest` (see `packages/shared-types/article.ts`). Notably:
- `authorId` is never accepted from the client — always the caller's own id.
- `status` is never accepted — always created as `published`.
- `excerpt`, `readTimeMinutes` are never accepted — always server-derived from `body`.
- `body` must be 800–2000 words (from the design's own "Write it yourself" validation copy),
  checked in `ArticlesService`, not expressible as a class-validator decorator for a single field.
- `practiceAreaIds` validated against a live, `is_active`-filtered `practice_areas` query before
  insert — same load-bearing check as applications' `servicePreferences`; see
  `docs/database-erd.md`.

**Response `201`:** `ArticleDto`. **Errors:** `401` no/invalid token · `403` client account · `400`
validation failure (malformed body, word count out of range, invalid/inactive practice area id).

### 🔒 `PATCH /v1/articles/:id`

Partial update. `@Roles('member')` rejects `client` at the guard layer; a finer-grained check in
`ArticlesService` then requires the caller be the article's own author **or** `admin` — anyone else
gets `403`. Owner or admin may also change `status` between `draft`/`published` here (self-service
unpublish/republish) — there's no separate moderation endpoint, since this session doesn't build an
admin review queue (see `docs/database-erd.md`).

**Request:** `UpdateArticleRequest` — all fields optional; only provided fields change. `body`,
`practiceAreaIds` re-validated the same way as `POST` if present; `excerpt`/`readTimeMinutes`
re-derived if `body` changes.

**Response `200`:** `ArticleDto`. **Errors:** `401` · `403` not the owner and not admin · `404` not
found · `400` validation failure.

### 🔒 `DELETE /v1/articles/:id`

Same owner-or-admin check as `PATCH`.

**Response `204`.** **Errors:** `401` · `403` not the owner and not admin · `404` not found.

## Articles — not built yet (explicitly deferred)

- Admin moderation/review queue (`pending`/`rejected` states, approve/reject actions) — the
  prototype models this; this session ships plain ownership-scoped CRUD instead. See
  `docs/database-erd.md`.
- Tags, AI-generated summary bullet points, view/like/comment counters — none of these are real
  per-article data in the prototype (tags are suggested-but-never-saved, summary points are a
  static per-category lookup, engagement is anonymous `localStorage` state) — out of scope for a
  CRUD-with-ownership contract.
- `category`/`country` query-param filtering on `GET /v1/articles` — the prototype filters
  client-side over the full published set; not built server-side yet.

## Events

Backing `apps/backend/src/events/`. Schema: `docs/database-erd.md`. Shared types:
`packages/shared-types/event.ts`. The `events` table itself already existed (schema-only, per
`docs/master-tdd.md`'s prior "🧱 Schema only" status) — only the module/controller/service were
missing.

### 🌐 `GET /v1/events`

**Query params:** `upcoming` (optional, default `true`). `true`/omitted preserves the original
homepage-only behaviour exactly (`status='published'` and not-yet-ended, soonest-first — see
`EventsService.listUpcoming()`'s comment for the start-of-UTC-day comparison rationale).
`upcoming=false` returns every `published` event regardless of date, ascending by `start_date` —
backs the standalone `/events` page's month-grouped browse list, which groups everything
chronologically rather than splitting past/upcoming.

**Response `200`:** `EventDto[]`.

### Not built yet (explicitly deferred)

- Public suggestion queue + admin moderation (`draft`→`published`/rejected) — `status` already
  supports this (`event_status` enum), but no write endpoints exist yet. All seeded rows are
  inserted directly as `published`. The `/events` page's "Suggest an event" card is a `mailto:`
  link, not a form, since there's nowhere to submit one yet.
- Country/format/date-range filtering on `GET /v1/events` itself — the standalone page filters
  client-side over the full `upcoming=false` set (same pattern as `/articles`), not query params,
  since the dataset is small (dozens, not thousands).

## Member directory & profiles

Backing `apps/backend/src/members/`. Schema: `docs/database-erd.md`. Shared types:
`packages/shared-types/member.ts`.

**Admin sub-tier permissions** — ported as real, server-checked authorization from
`assets/admin-data.js`'s existing client-side model (see `docs/database-erd.md` for the full
correction to `roadmap.md`'s scoping). Three roles (`super_admin`, `content_manager`, `reviewer`),
each mapped to a fixed permission list in `apps/backend/src/auth/constants/admin-permissions.ts` —
a backend constant, not a DB table, same "simplest thing that works, no admin UI to manage it yet"
call already made for coupons. A route tagged 🛡️ _permission_ below requires `role='admin'` **and**
that the caller's `admin_role` (fresh-read from `profiles`, never trusted from the JWT — same
posture `RolesGuard` already uses for the plain `admin` role) maps to a role carrying that
permission. A plain `admin` with no `admin_role` set is treated as `super_admin` (has every
permission) — this only matters for accounts created before this session; every admin created going
forward should get an explicit `admin_role`.

### 🌐 `GET /v1/members`

The directory list — published/active members only.

**Query params:** `q` (search across name/practice/location/firm/title), `practiceAreaId`
(repeatable), `country` (repeatable), `rateMinCents`/`rateMaxCents`, `sort`
(`featured`\|`tenure`\|`rate_asc`\|`rate_desc`, default `featured`), `page`/`pageSize` (default
`pageSize=8`, matching the prototype's infinite-scroll page size).

**Response `200`:** `MemberListItemDto[]` — id, name, initials, headline, bio, firmName, region,
country, city, practiceAreas (`{id, name}[]`, from `member_services`), isVerified, memberTier,
yearsOfExperience, rateMinCents, rateMaxCents, rateCurrency, photoUrl. Tenure/rate display strings
(`"18y"`, `"$420/hr"`) are **not** returned — format them client-side from the numeric fields.
`bio` is the full field (not pre-truncated) — the directory card excerpt is a client-side
`line-clamp-2`, matching the design's own approach, so no separate excerpt field was added.

### 🔒 `GET /v1/members/:id`

Full profile — all `member_profiles` columns, all 8 child arrays, `memberServices`. **Requires
sign-in** (any authenticated role) — a deliberate product decision, not something the static
prototype itself consistently enforces; see `docs/database-erd.md`'s "Design decisions" note.

A member's own published articles are **not** embedded here — fetch
`GET /v1/articles?authorId=:id` separately (see that endpoint's note above). `memberServices`
resolves practice area names the same way `ArticlePracticeArea` does.

**Response `200`:** `MemberDto`. **Errors:** `401` no/invalid token · `404` not found, not
`status='active'`, or the caller isn't its owner (same "don't leak existence" posture as a draft
article — a deactivated profile that isn't the caller's own returns `404`, not `403`).

### 🔒 `POST /v1/members/:id/uploads`

Requests a signed upload URL for a proof file or a key-client logo — Supabase Storage bucket
(`member-proofs`), member uploads directly to the returned URL, this endpoint never sees file
bytes. `@Roles('member')`, owner-only (`:id` must equal the caller's id).

**Request:** `{ fileName: string, contentType: string }`. **Response `201`:** `{ uploadUrl: string,
path: string }` — `path` is what gets sent back as `proofFileUrl`/`logoUrl` in a subsequent edit
submission, not the raw `uploadUrl`.

### 🔒 `PATCH /v1/members/:id/edits`

Submit a self-edit proposal for one section. `@Roles('member')`, owner-only (service-layer check,
same pattern as `PATCH /v1/articles/:id`'s owner-or-admin check but stricter — no admin bypass
here, since this is a submission, not a direct write). Creates a `pending` `member_profile_edits`
row; **never touches the live profile** — that only happens on admin approval (see below).

**Request:** `CreateMemberEditRequest` — `{ section, payload, proofFileUrl?, proofLink? }`. Shape of
`payload` depends on `section` (see `packages/shared-types/member.ts` for the per-section
discriminated union) and matches the section's actual base-data shape — **not** the prototype's
flattened single-string-per-item shortcut (see `docs/database-erd.md`).

**Response `201`:** `MemberProfileEditDto`. **Errors:** `401` · `403` not this member · `400`
validation failure (payload shape doesn't match `section`).

### 🔒 `GET /v1/members/:id/edits`

Owner's own edit requests, any status, newest first — drives the "pending verification" badge.
Owner-only, same posture as `GET /v1/articles/me`.

**Response `200`:** `MemberProfileEditDto[]`.

### 🛡️ `manageMembers` `GET /v1/admin/members`

All members, including `deactivated`, unfiltered by the public directory's `status='active'`
constraint.

**Response `200`:** `MemberListItemDto[]` plus `status`, `applicationId`,
`membershipStartedAt`, `renewalPaymentStatus`, `renewalDueState` (computed
`active`\|`due-soon`\|`overdue` from `member_renewal_policy` — see `docs/database-erd.md`).

### 🛡️ `manageMembers` `PATCH /v1/admin/members/:id`

Admin override of `status`, `membershipStartedAt`, `renewalPaymentStatus`. Does not touch anything
the self-edit flow governs (headline, bio, child tables, etc.) — that's `member-edits` below, kept
separate so "admin corrects a lifecycle fact" and "member requests a content change" stay distinct
audit trails.

**Response `200`:** the updated admin member record (same shape as one row of `GET
/v1/admin/members`).

### 🛡️ `manageMembers` `GET /v1/admin/member-edits`

All pending (default) or any-status edit requests across every member, newest first. Query param
`status` (optional, defaults to `pending`).

**Response `200`:** `MemberProfileEditDto[]`, each including the member's name/id for display.

### 🛡️ `manageMembers` `PATCH /v1/admin/member-edits/:id`

Approve or reject one edit request. `{ status: 'verified' | 'rejected', reviewNote?: string }`. On
`verified`: for the array-shaped sections, replaces that member's child-table rows for the section
wholesale with `payload`'s items; for `headline_bio`/`contact`, overwrites the corresponding
`member_profiles` columns directly. Sets `reviewedBy`/`reviewedAt` to the caller/now either way.

**Response `200`:** `MemberProfileEditDto`. **Errors:** `409` if the edit is no longer `pending`
(already reviewed).

### 🛡️ `manageMembers` `GET` / `PATCH /v1/admin/renewal-policy`

The single sitewide renewal policy row. `PATCH` body: `{ periodMonths?, reminderDays? }`.

**Response `200`:** `{ periodMonths: number, reminderDays: number, updatedAt: string }`.

## Member directory & profiles — not built yet (explicitly deferred)

- Promoting an approved `membership_applications` row into a real `member_profiles` row — blocked
  on the applications admin-review endpoint, itself still deferred (see that section above).
- The "Referrals"/gamified-goal dashboard widget — confirmed zero backing logic anywhere in the
  prototype; explicitly dropped, not a shortcut.
- "Schedule a Call" — confirmed frontend-preview-only in the prototype's own code, no backend
  wiring intended.
- Full-text/fuzzy search on `q` — this session's `GET /v1/members` does a straightforward
  `ilike`-style match; a real search index is a separate future concern if the member count grows
  large enough to need one.
