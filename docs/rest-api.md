# GrowXQ — REST API

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

**Off in production** (since 2026-10-29): served only when `NODE_ENV !== 'production'`, or when
`SWAGGER_ENABLED=true` is set explicitly — it hands a full map of every route, admin ones included,
to anyone with the URL.

## Errors

Every error response — validation, auth, rate limit, not found, unexpected — has one shape, produced
by the global `HttpExceptionFilter` (`apps/backend/src/common/http-exception.filter.ts`):

```json
{ "statusCode": 409, "code": "CONSULTATION_PENDING_EXISTS", "message": "…" }
```

- `code` is stable and machine-readable — clients branch on it, never on `message`. Endpoint-
  specific codes are listed under each endpoint; anything without one gets the status default:
  `BAD_REQUEST`, `VALIDATION_FAILED` (DTO validation — `message` is then an array of strings),
  `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`,
  `INTERNAL_ERROR`, `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`.
- `429` responses also carry `retryAfterSeconds`.
- A `5xx` never includes a database or provider message (it's logged server-side instead).

Auth codes every protected route can return: `401 SESSION_MISSING` / `SESSION_INVALID`;
`403 ACCOUNT_SUSPENDED` (the token's `app_status` claim isn't `active`); `403 ROLE_REQUIRED`;
`403 MEMBER_DEACTIVATED` (member-only route, the caller's member profile is deactivated);
`403 ADMIN_NOT_CONFIRMED` (admin route, fresh `profiles` check failed).

## List sizes

Paginated lists cap their page size (`GET /v1/articles` 50, `GET /v1/members` 50, AI search 10).
Every other list endpoint — admin queues, a user's own lists, resource catalogs, events — returns at
most **500 rows** (`MAX_LIST_ROWS`, `apps/backend/src/common/list-limits.ts`), newest first where the
list is a queue or history; the admin AI-generations log keeps its own 200.

## Rate limits

Every authenticated route is rate-limited **per user** (`RateLimitGuard`,
`apps/backend/src/common/rate-limit/`) → `429 RATE_LIMITED` with `retryAfterSeconds`. Default: 300
requests/minute. Tighter, shared buckets on the expensive or abusable routes:

| Bucket | Routes | Limits |
|---|---|---|
| `ai-draft` | `POST /v1/articles/ai-draft` | 3/min, 20/hour, 50/day |
| `ai` | `ai-refine`, `ai-followup-questions`, `suggest-topics` | 10/min, 60/hour, 200/day |
| `linkedin-import` | `POST /v1/applications/me/linkedin-import` | 5/hour, 10/day |
| `cover-images` | `GET /v1/articles/cover-images` | 20/min, 200/hour |
| `coupon` | `POST /v1/applications/me/coupon-preview` | 10/min, 30/hour |
| `upload` | application uploads + LinkedIn photo, `POST /v1/members/:id/uploads` | 20/min, 200/day |
| `write` | create article, member edit, consultation + message, recommendation | 20/min, 300/day |

`POST /v1/search` additionally keeps its own limits (see "AI search"). Counters are in memory, i.e.
per API instance. Anonymous (`🌐 Public`) requests aren't counted: public pages are server-rendered
by the Next.js app, so all signed-out traffic reaches the API from one server IP — public endpoints
rely on capped page sizes, Next's data cache and the reverse proxy's edge rate limit instead
(`docs/deployment.md`).

## Membership applications

Backing `apps/backend/src/applications/`, `apps/backend/src/categories/`,
`apps/backend/src/services/`. Schema: `docs/database-erd.md`. Shared types:
`packages/shared-types/membership-application.ts`, `packages/shared-types/category.ts`,
`packages/shared-types/service.ts`.

### 🌐 `GET /v1/categories`

Returns the active category→service taxonomy tree for the application wizard's service-preference
picker, the member directory's filter, and the article authoring flow's service tagging.
`practice_areas`/`GET /v1/practice-areas` (a flat, 12-row list with a 3-value `category` enum) was
replaced outright by a real two-level `categories`→`services` taxonomy (17 categories, 138
services) — see `docs/database-erd.md`'s `categories`/`services` section and
`docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md` for the full rationale.

**Response `200`:** `CategoryDto[]` — `{ id: string, name: string, sortOrder: number, imageUrl:
string | null, isActive: boolean, services: ServiceDto[] }[]`. `ServiceDto` — `{ id: string,
categoryId: string, name: string, sortOrder: number, isCustom: boolean, isActive: boolean }`.
`isCustom` marks the one "<<Custom Field>>" placeholder service some categories have — selecting it
in the UI reveals a free-text input whose value is persisted as a `customLabel`/
`customServiceLabels` sidecar on whichever table references the service id (see below). `imageUrl`
is decorative-only representative art (the homepage's Categories marquee) — nullable, never blocks
rendering when absent; unlike the old `practice_areas` seed, no images are seeded for the 17
categories today.

**🛡️ Admin CRUD** (`manageTaxonomy` permission): `GET/POST/PATCH/DELETE
/v1/admin/categories[/:id]` and `POST /v1/admin/categories/:categoryId/services`,
`PATCH`/`DELETE /v1/admin/services/:id`. Deleting a category with services, or a service still
referenced by a member/article/application, returns `409` (`CATEGORY_HAS_SERVICES` /
`SERVICE_IN_USE`) rather than cascading.

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
- `workExperiences` in the body (2026-10-10) → validated and stored **newest-first**: an end before its start is `400 WORK_HISTORY_END_BEFORE_START` (a current role counts as ending today; missing months count as January). Overlapping date ranges are allowed (2026-10-21: `WORK_HISTORY_OVERLAP` is no longer returned — concurrent roles are real; the UI only warns). Items accept optional `startMonth`/`endMonth` (1-12). Approval now carries months and sets `isVerified: true` on the provisioned work history/education.
- `status: 'submitted'` in the body → after merging, the **merged row** (not just this call's
  body) must satisfy every requirement the old one-shot `POST /v1/applications` used to enforce
  (all identity/background/services/rates fields present, `workExperiences`/`educations`/
  `servicePreferences` non-empty, **`workExperiences` must include one entry with
  `isCurrent: true` and a non-empty `company`** (added 2026-09-27 — this becomes the approved
  member's `firm_name`, so it can't be silently absent), `peerReferences` exactly 2 entries (added
  2026-08-31 per client feedback), `rateMaxCents > rateMinCents`, `backgroundCheckConsent: true`,
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
- `billingPeriod` — annual only as of 2026-08-31 (`BillingPeriod` is now a single-member
  `'annual'` union); `'monthly'` is rejected by validation, not silently accepted.
- `peerReferences` — up to 2 entries while a draft, exactly 2 required to submit; each is
  `{ name, relationship, email, phone? }`.
- `servicePreferences[].serviceId` is validated against a live, `is_active` `services` query
  whenever a call actually includes `servicePreferences` — the DB has no FK to catch an invalid id
  (see `docs/database-erd.md`). Not re-validated on calls that don't touch this field (a
  previously-valid, now-deactivated selection isn't retroactively rejected mid-draft). When the
  referenced service is `isCustom`, `customLabel` becomes required on that entry. **The same
  `serviceId` cannot appear in more than one priority slot** — rejected with `400` (previously
  allowed, which let two different "Other" custom labels collide on the same generic service id
  and crash approval later — see the admin section below).
- `bio` — up to 2000 characters (raised from 500 on 2026-09-26 — the old limit was silently
  truncating a normal-length professional bio mid-sentence).
- `region` — **no longer accepted from the client at all** (accepted-but-ignored if sent; the DTO
  field is kept only for backward compatibility with older callers). Always derived server-side
  from `country` via a small fixed map (`apps/backend/src/applications/constants/country-region.ts`)
  whenever a call's patch touches `country`. `country: 'Other'` has no defensible region and is
  left `null`, exempted from the submit-completeness check.
- `selectedTier`, `listPriceCents`, `discountAmountCents`, `amountDueCents`, `paymentStatus`,
  `status` (beyond the `'draft'|'submitted'` request flag), `applicantId` are **never accepted
  from the client** — computed server-side exactly as before:
  - `selectedTier`: `yearsOfExperience > 12 → seasoned_professional`, else `budding_entrepreneur`.
  - `listPriceCents`: flat `$499/year` or `$49/month` regardless of tier.
  - `couponCode` (optional, free text) checked against a small hardcoded map — an unrecognized
    code is rejected with `400` at submit time, not silently ignored.
  - `paymentStatus` is `waived` if `amountDueCents` resolves to `0`, else `pending`.

**Response `200`:** `ApplicationDto` — the full current record (draft or submitted), including
resolved `servicePreferences[].serviceName`/`categoryId`/`categoryName`, a `photoUrl` (a plain,
permanent public URL built from the Storage path at read time — see the uploads endpoint below),
`documents[]` (each `url` a 15-minute signed URL — see the uploads endpoint below), and (added 2026-09-27, also surfaced on the admin detail endpoint above)
`backgroundCheckConsent`/`termsVersionAgreed`/`privacyVersionAgreed`.

**Errors:** `401` no/invalid token · `403` not a client account · `409` application pending or
already approved · `400` validation failure (malformed body, invalid/inactive practice area id,
invalid coupon, `rateMax <= rateMin`, or — only when `status: 'submitted'` — incomplete required
fields, named in the message).

### 🔒 `GET /v1/applications/me`

The caller's own most recent application (draft or otherwise). Always owner-scoped by the
authenticated user's id — never accepts an id param, so there's no cross-user access surface.

**Response `200`:** `ApplicationDto`. **`404`** if the caller has no application at all yet.

### 🔒 `POST /v1/applications/me/linkedin-import`

**Request:** `{ linkedinUrl }` — must be a LinkedIn profile URL (`linkedin.com/in/<handle>`, scheme
and country subdomain optional, ≤300 chars; added 2026-10-29), since it's forwarded to a paid
scraping agent. Pure fetch-and-normalize — does **not** write to the draft. Fetches whatever profile data the
configured `LinkedInImportProvider` can produce for the given URL and returns it directly; the
frontend merges the result into its wizard state and saves it through `POST /v1/applications/me`
like any manually-entered edit, so there's exactly one write path regardless of how the data
originated. Backed by `N8nLinkedInImportProvider` unconditionally as of 2026-09-26 — the mock
fallback (`MockLinkedInImportProvider`, used when `LINKEDIN_IMPORT_WEBHOOK_URL` was unset) has been
deleted; a missing webhook URL now throws `502 Bad Gateway` ("LinkedIn import is not configured.")
at call time instead of silently returning fake profile data. See
`docs/superpowers/specs/2026-08-25-linkedin-import-real-provider-design.md` for the n8n
request/response contract and field-mapping rules.

**Request:** `LinkedInImportRequest` — `{ linkedinUrl: string }`.
**Response `201`:** `LinkedInImportResponse` — every field optional; absent fields mean "couldn't
be extracted." `bio` is capped at 2000 chars (raised from 500 on 2026-09-26); truncation, only
when the raw scrape still exceeds that, happens at the last word boundary with a visible
`… (truncated)` suffix rather than a silent mid-sentence cut. (NestJS's default status for a
`POST` handler with no `@HttpCode()` override — confirmed live, not `200` as previously documented
here.)

**2026-10-21:** every scraped role is returned (previously only the first 5, so a long or
sub-role-heavy history lost its older jobs), capped at 15 after dropping unusable entries; sub-roles
at one company come through as separate rows that may overlap in time. Each role now carries an
optional `description` (≤2000 chars), which `WorkExperienceInput`/`POST /v1/applications/me`
accept and approval copies onto the member's work history. Education is capped at 5 (was 3).
New optional `photoUrl`: the scraper's 800×800 LinkedIn photo (`https://media.licdn.com/...` only)
— send it to `POST /v1/applications/me/photo/linkedin` as `sourceUrl`. `POST /v1/applications/me`
now accepts up to 15 `workExperiences` and 5 `educations`.

### 🔒 `POST /v1/applications/me/photo/linkedin`

Added 2026-09-26. Best-effort: pulls the `picture` claim off the caller's linked LinkedIn OAuth
identity (via the Supabase Admin API — `auth.identities`, not a public-schema table) and stores it
through the exact same path as a manual photo upload below. Never overwrites a photo the applicant
already has; the frontend only calls this when `photoUrl` is still unset (or still the photo it
imported itself).

**Request (optional, 2026-10-21):** `LinkedInPhotoImportRequest` — `{ sourceUrl?: string }`. When
given, that image is fetched instead of the OAuth `picture` claim (which is ~100×100 and looked
blurred on profiles). Must be an `https://media.licdn.com/...` URL — anything else is `400`
(server-side fetch, so the host is pinned); redirects are refused. Use the `photoUrl` returned by
`POST /v1/applications/me/linkedin-import`. An empty body (`{}`) or no body keeps the old behavior.

**Response `200`:** `ApplicationDto`, same shape as the manual upload endpoint. **Errors:** `404`
no LinkedIn identity linked or it has no `picture` claim · `502` the picture URL couldn't be
fetched.

### 🔒 `POST /v1/applications/me/coupon-preview`

Added 2026-09-26. Stateless price calculation — reuses the exact `applyCoupon()` logic the real
submission path uses, so the review step can show the real discounted price live as a coupon code
is typed instead of a hardcoded label that never reflected it. Doesn't touch or require a draft
application to exist.

**Request:** `CouponPreviewRequest` — `{ billingPeriod: 'annual', couponCode?: string }`.
**Response `200`:** `CouponPreviewResponse` — `{ valid, listPriceCents, discountAmountCents,
amountDueCents }`. `valid: false` (with `discountAmountCents: 0`) when a non-empty `couponCode`
doesn't match a known code — not an error response, so the frontend can render "invalid code"
inline without a failed request.

### 🔒 `POST /v1/applications/me/uploads`

`multipart/form-data`, fields `kind` (`'photo' | 'document'`) and `file`. Proxies the upload
through the backend rather than issuing a signed upload URL (unlike
`POST /v1/members/:id/uploads`) — a signed-URL flow never puts the file's bytes through the API,
so magic-byte MIME validation (root `CLAUDE.md`'s non-negotiable file-upload rule) would be
structurally impossible there. Bytes are sniffed with `file-type` against an allow-list
(`photo`: JPEG/PNG, 5MB max; `document`: JPEG/PNG/PDF, 15MB max) before being written to Storage. A `photo` goes to the public `application-assets` bucket, always at
`members/application/{applicantId}/profile-photo` (**no extension**, fixed 2026-09-26: the path
used to bake in the sniffed extension, so re-uploading in a different format, e.g. jpg → png,
produced a second orphaned object instead of replacing the first; the upload call is `upsert:
true`, so a stable key is what actually makes re-upload behave like a replace). A `document` goes to
the **private** `application-documents` bucket at `{applicantId}/{documentId}.<ext>` (changed
2026-10-29 — documents used to be public at a guessable `document-{n}.<ext>` path). Only allowed
while the caller has a `draft` application.

**Response `200`:** `ApplicationDto` — the updated record. `photoUrl` is a plain public URL built
from the stored path; each `documents[].url` is a signed URL valid for 15 minutes, minted fresh on
every read (a document whose object is missing from Storage is omitted). **Errors:** `400` no draft to attach to,
oversized file, or a MIME mismatch (including a renamed file whose magic bytes don't match its
extension/declared content-type).

## Membership applications — admin

### 🛡️ `manageApplications` `GET /v1/admin/applications/:id`

Full detail for the admin review page (`apps/frontend/app/(shell)/admin/applications/[id]/`) — the
exact same `ApplicationDto` shape the applicant sees on their own `GET /v1/applications/me`,
including `servicePreferences[]` so the admin can pick which one to approve.

**Response `200`:** `ApplicationDto`. **Errors:** `401`/`403` per the 🛡️ badge · `404` no such
application.

### 🛡️ `manageApplications` `PATCH /v1/admin/applications/:id`

Approve or reject a `submitted`/`under_review` application. Consumed by
`components/admin/ApplicationReviewDetail.tsx` via the `apps/frontend/app/(shell)/admin/applications/[id]/page.tsx`
detail page — `AdminApplicationsTable.tsx` only links to that page and no longer calls this
endpoint directly.

**Request:** `AdminApplicationReviewRequest` — `{ status: 'approved' | 'rejected', rejectionReason?:
string, approvedServiceId?: string, memberTier?: MembershipTier, membershipStartedAt?: string }`
(`rejectionReason` required when rejecting; `approvedServiceId` required when approving, as of
2026-09-26). `memberTier`/`membershipStartedAt` are optional admin overrides used only when
approving — added 2026-09-27. `memberTier` falls back to the applicant's own computed
`selectedTier` when omitted; `membershipStartedAt` (ISO date) falls back to "now" when omitted.
Both map directly onto the same `member_profiles.member_tier`/`membership_started_at` columns
`PATCH /v1/admin/members/:id` already treats as admin-editable — this is the same "admin corrects a
lifecycle fact" concept at provisioning time, not a new one.

**On approve:** provisions a `member_profiles` row (1:1 field mapping from the application row)
and exactly **one** `member_services` row — for `approvedServiceId`, which must be one of the
applicant's own submitted `service_preferences` (`400` otherwise) — then flips `profiles.role` to
`'member'`, then marks the application `approved` — in that order, so a mid-sequence failure
leaves the application `submitted` (still reviewable) rather than silently `approved` with no
member actually provisioned. Not a true DB transaction — supabase-js has no multi-statement
transaction API from a service-role client.

`member_profiles.member_tier` is `memberTier` if the admin supplied one, else the application's own
`selected_tier`; `membership_started_at` is `membershipStartedAt` if supplied, else the time of
approval — both set explicitly on insert now, not left to the DB's `now()` default the way
`membership_started_at` used to be. No `member_profiles.approved_by` column — the reviewing admin
is traceable via `member_profiles.application_id` → `membership_applications.reviewed_by` (a
deliberate decision, not a gap — see
`docs/superpowers/specs/2026-09-27-admin-application-review-detail-design.md`).

Fixed 2026-09-27: `insertMemberProfile()` had never actually mapped `firm_name`/`firm_website`/
`contact_phone`/`work_experiences`/`educations` from the application — a pre-existing gap that
only surfaced once an application was approved end-to-end for the first time (every prior approve
silently left these null/empty). Now: `firm_name`/`firm_website` come from whichever
`work_experiences` entry has `isCurrent: true` (`company`/`companyUrl`); `contact_phone` joins the
application's split `phoneCountryCode`+`phone` into one string; `work_experiences`/`educations` are
mapped into the member profile's own simpler per-item shape (`id`-keyed
`MemberWorkExperience`/`MemberEducation`, dropping fields like `city`/`firmSize`/`companyUrl` the
member-facing shape doesn't carry). `assertComplete()` (submit-time validation on
`POST /v1/applications/me`) now requires at least one `workExperiences` entry to be `isCurrent`
with a non-empty `company` — this is what becomes `firm_name`, so it's compulsory to submit, not
optional.

Changed 2026-09-29: that same `isCurrent` entry's `companyUrl` is now also required at submit —
`member_profiles.firm_website` became `NOT NULL`, so it's no longer optional the way
`WorkExperienceDto.companyUrl` (`@IsOptional() @IsUrl()`, unchanged) suggests in isolation; the
requirement is a cross-field, submit-time rule in `assertComplete()`, not a DTO-level one, since it
only applies to the `isCurrent` entry, not every role. No exemption for an independent
practitioner with no `firm_name` — `@IsUrl()` already accepts any well-formed URL, so a personal
site or a LinkedIn company/profile page satisfies it just as well as a firm domain.

Changed 2026-09-26: previously provisioned a `member_services` row for **every** submitted
preference with no way to approve just one, which (a) meant "forgetting" to narrow it down
approved all of them, and (b) crashed outright if two preferences shared a `serviceId` (most
commonly two different "Other" custom labels — `member_services`' primary key is
`(member_id, service_id)`, so the second insert violated it). `GET /v1/admin/applications` now also
returns each row's `servicePreferences[]` (serviceName/customLabel resolved, same shape as
`ApplicationDto`) specifically so the approving admin can choose from them. Also returns
`phoneCountryCode`/`phone`/`linkedinUrl`/`yearsOfExperience` (added 2026-09-27) so the review queue
table can show enough to triage without opening the detail page — the admin UI filters this list
client-side (by name, by status) rather than via new query params, since the queue is small and
already fully loaded per request.

**Default status filter changed 2026-09-27, twice**: first to also include `rejected` (with its
`rejectionReason`, also added to this list row) instead of dropping a decided-rejected application
from view entirely; then, same day, to drop the server-side status filter altogether — with no
`status` query param this now returns **every** status, including `draft` and `approved`, newest
first, and `createdAt` is shown per row so the admin can tell drafts/old submissions apart. The
admin table filters client-side (by name, by status) rather than the backend narrowing what it
returns — the queue is small and already fully loaded per request either way. An explicit
`?status=` value is unchanged — it still filters to exactly that one status.

**On reject:** stamps `reviewed_by`/`reviewed_at`/`rejection_reason` only.

**Errors:** `401`/`403` per the 🛡️ badge · `404` no such application · `409` application isn't
`submitted`/`under_review` · `400` rejecting without a `rejectionReason`, approving without a
valid `approvedServiceId`.

## Membership applications — not built yet (explicitly deferred)

- Member directory (`GET /v1/members`, `GET /v1/members/:id`) — separate future backend session.
- Real payment gateway integration — `payment_status='paid'` is modeled but unreachable.

## Articles

Backing `apps/backend/src/articles/`. Schema: `docs/database-erd.md`. Shared types:
`packages/shared-types/article.ts`.

Every `ArticleDto`/`ArticleListItemDto` carries a `slug` — generated server-side from `title` on
`POST` (kebab-case, disambiguated with a `-2`/`-3`/... suffix on collision), never client-writable
and never regenerated on `PATCH`. `GET /v1/articles/:idOrSlug` accepts either the UUID or the slug
(added 2026-10-24 — the frontend's detail route is `/articles/[slug]`); the mutating routes
(`PATCH`/`DELETE`, admin review) still key on the UUID only.

`authorPhotoUrl: string | null` — sourced from the author's `member_profiles.photo_path` (a plain
public URL built from the `application-assets` Storage path at read time — see
`docs/database-erd.md`), falling back to `profiles.avatar_url`, same posture as `MembersService`'s
`photoUrl`, null when neither is set.
`authorHeadline`/`authorFirmName: string | null` — sourced from `member_profiles.headline`/
`firm_name`, the "designation" line under the author's name/photo. All three are additive fields,
no version bump.
`authorSlug: string | null` (added 2026-09-27) — the author's `member_profiles.slug`, used to link
to and fetch the author's profile (`GET /v1/members/:slug`); null when the author has no member
profile. Additive, no version bump.

`aiSummary: string | null` — a short 3-to-4-point summary rendered as the detail page's "AI
Summary" callout (one bullet per `\n`-separated line), sourced from `articles.ai_summary`.
Generated once, server-side, by `ArticlesService.generateSummaryIfNeeded()` (`AiService.
summarizeArticle`) the first time an article transitions to `status: 'published'` — fired async
and never awaited by the publish/approve request, so it never blocks or fails that response; on
an AI failure the field is just left `null` and the error is logged, no retry. Uses the same
`AI_PROVIDER`/`AI_MODEL` config as `POST /v1/articles/ai-draft`. Not regenerated on later edits to
an already-published article. Seed data (`supabase/seed/dev/03_articles.sql`) still
pre-populates it for dev fixtures so the callout has something to show without waiting on a real
model call. Additive, no version bump.

### 🌐 `GET /v1/articles`

The browse grid — published articles only, list shape (no `body`).

**Query params** (all optional; `ListArticlesQuery` in `packages/shared-types/article.ts`):
- `authorId` (UUID) — added by the Member Directory & Profiles session so a member's profile page
  can list their own published articles via this endpoint rather than an embedded/duplicated array
  (the prototype embeds a copy of the author's articles directly on the profile object — not
  reproduced).
- `serviceId` (UUID, repeatable) / `country` (repeatable) — added 2026-10-24 with pagination. Each
  matches articles carrying **any** of the given values; the two combine with AND. Replaces the
  browse grid's old client-side filtering, which only worked while the whole set was loaded.
- `excludeId` (UUID) — leaves one article out (the "related articles" box excludes the one being
  read).
- `page` / `pageSize` (positive integers) — added 2026-10-24. Sending either one pages the result
  (`page` defaults to 1, `pageSize` to 12, capped at 50); sending **neither** returns the first 50
  matches (changed 2026-10-29 from "every match" — no list is unbounded; `X-Total-Count` still
  reports the full total, so a caller can tell when there are more).
  Order is `created_at` desc with `id` as tiebreak, so page boundaries are stable.

**Response `200`:** `ArticleListItemDto[]`, newest first — always a plain array (no envelope).
**Header `X-Total-Count`:** the total number of matches across all pages (exposed via CORS
`Access-Control-Expose-Headers`, so browser callers can read it). **Errors:** `400` a non-UUID
`authorId`/`serviceId`/`excludeId`, or a `page`/`pageSize` that isn't a positive integer.

### 🌐 `GET /v1/articles/:idOrSlug/preview`

Added 2026-10-24. The public teaser of one **published** article — `ArticleListItemDto` (title,
excerpt, cover, author, services…, no `body`), by UUID or slug. Backs the signed-out article page,
which used to fetch the whole list just to find one entry. **Errors:** `404` no published article
with that id/slug (drafts, pending and rejected articles are indistinguishable from missing).

### 🔒 `GET /v1/articles/me`

The caller's own articles, any status (`draft` included). Empty array if none — not a `404`, since
this is a list endpoint, unlike `GET /v1/applications/me`. Named `me`, not `mine`, to match that
same convention rather than inventing a second word for "the caller's own resource."

**Response `200`:** `ArticleListItemDto[]`, newest first.

### 🔑 `GET /v1/articles/:idOrSlug`

Full article detail, including `body`. The path segment is either the article's UUID or its
`slug` (e.g. `/v1/articles/rbi-s-new-nbfc-framework`) — a UUID-shaped value is looked up by `id`,
anything else by `slug`. Additive (UUID lookups behave exactly as before), so no `/v2`. Requires being signed in (any role) — **a deliberate product
decision, not something the static prototype itself enforces**; see
`docs/database-erd.md`'s "Design decisions" note for the full reasoning.

If the article's `status` is `draft`, only its own author or an `admin` can read it — everyone else
gets **`404`, not `403`**, so a non-owner can't distinguish "doesn't exist" from "exists but isn't
published yet."

**Response `200`:** `ArticleDto`. **Errors:** `401` no/invalid token · `404` not found, or a draft
the caller can't see.

### `member` `POST /v1/articles/ai-followup-questions`

The AI wizard's step between the initial brief and "Finishing touches" — analyzes the member's
written brief and returns the minimum useful set of follow-up questions, so the wizard can skip
straight past this step when the brief is already specific enough. Plain JSON (unlike `ai-draft`
below — no files here). Same hosted web-search/fetch tool as `ai-draft` is available to the model
so it can check current facts before deciding what to ask, used only when it would change which
questions get asked.

**Request:** `AiFollowUpQuestionsRequest` (see `packages/shared-types/article.ts`) —
`notes`/`advice` required, `recentDevelopments` optional. No `serviceIds`/`countries`/`state` —
generates purely from the written brief; follow-up question quality comes from the notes content,
not from taxonomy context, so this endpoint doesn't need the member to have picked anything first.

**Response `201`:** `AiFollowUpQuestionsResponse` — `{ questions: string[] }`, 0 to 10 items. An
empty array is a valid, expected result — not every brief needs follow-ups. **Errors:** `401` ·
`403` client account · `400` validation · `503` AI drafting not configured or the provider call
failed (same causes as `ai-draft`).

### `member` `POST /v1/articles/ai-draft`

The AI wizard's "Generate" step — generates a `{ title, body }` draft using the backend's fixed,
env-configured AI provider+model (`AI_PROVIDER`/`AI_MODEL` in `apps/backend/.env`, resolved in
`apps/backend/src/ai/ai.service.ts` via the Vercel `ai` SDK — `@ai-sdk/openai` /
`@ai-sdk/anthropic` / `@ai-sdk/google` depending on `AI_PROVIDER`, never a client-chosen
provider/model). **Does not save anything** — the member reviews/edits/refines the result
client-side, then saves it via `POST /v1/articles` below (typically with `creationMode: 'ai'`).

**Request:** `multipart/form-data`, not JSON — a `payload` field carrying the
`AiDraftArticleRequest` shape (see `packages/shared-types/article.ts`) as a JSON string, plus zero
or more `files` parts (the wizard's source-document dropzone; PDF, JPEG, PNG, WebP, or TXT — DOCX
is not supported, see below). Why multipart: the JSON-only fields (`notes`, `recentDevelopments`,
`advice`, `followUpAnswers`, `followUpQuestionsAsked`, `sourceLinks`, `includeVisual`, `tone`,
`extraInstructions`) needed to travel alongside real file uploads in one request, same reasoning
as the membership-application photo upload endpoint. No `title`/`serviceIds`/`countries`/`state`
— the model infers all four (see Response below) rather than the member picking them beforehand;
`notes`/`advice` stay optional at the DTO level, matching the existing pattern where the real
"must be filled in" enforcement is the wizard's own step-1 gate, not a hard server requirement.

PDF and image uploads are sent to the model as **native documents** (`apps/backend/src/ai/
prepare-source-file.ts`, magic-byte checked via `file-type` first, per root CLAUDE.md's
non-negotiable upload rule) — raw bytes, no text extraction, no fidelity loss, so tables/layout/
charts in a source document are preserved. TXT uploads stay on the previous behavior: embedded as
literal text in the prompt (capped at 8,000 characters per file). DOCX is not accepted — members
export to PDF first; this was a deliberate choice over embedding a document-conversion engine
(LibreOffice) in the backend, given the ongoing CPU/memory/image-size cost that would add for no
real usage data yet to justify it.

**Every uploaded file is persisted** to a private Supabase Storage bucket (`ai-draft-sources`,
see `docs/database-erd.md`), linked to the `ai_draft_generations` audit row that also now logs the
member's pasted `sourceLinks` — both purely for traceability of what an article was actually
generated from; neither changes what the model receives in the request itself.

The model has web-search/fetch access via the currently-configured `AI_PROVIDER`'s own hosted web
tool (see `AiService.resolveModelWithSourceLinkTool`), but only OpenAI's `webSearch` tool actually
searches the open web and reliably produces the `sources` citations below — Anthropic's
`webFetch_20260209` can only fetch URLs it's already given (the member's `sourceLinks`, or ones
the model finds some other way), not search for new ones, and Google's `urlContext` doesn't
populate `sources` without Search grounding separately configured (not done here). Open,
unprompted research and reliable citations are effectively an OpenAI-only capability today; on
the other two providers this behaves closer to the old `sourceLinks`-only fetch behavior. Same
`@Roles('member')` posture as `POST /v1/articles`.

`followUpAnswers` (max 10) carries only the follow-up questions from `ai-followup-questions` above
that the member actually answered — blanks are omitted client-side. `followUpQuestionsAsked` (max
10) separately echoes back the *full* question list that endpoint returned, even ones left blank —
this isn't used in the generation prompt, only recorded in the `ai_draft_generations` audit log
(see `docs/database-erd.md`) so "asked but skipped" can be told apart from "never asked".

**Response `201`:** `AiDraftArticleResponse` — carries `generationId` (added 2026-10-04,
additive: the id of this attempt's `ai_draft_generations` audit row — send it back as
`aiGenerationId` on `POST /v1/articles` so the saved article links to what it was generated
from; never present on `ai-refine`'s response), `sources` (URLs the model actually
fetched/searched while drafting, `{url, title}[]`, null/empty when none) alongside `title`/`body`,
plus AI-inferred `serviceIds`/`countries`/`state`. The model is given the real active services
list (`{id, name}` pairs, fetched fresh for every request — never client-supplied) and the real
countries list alongside the brief, and asked to pick from them; the backend validates every
returned name against those same lists and resolves matched service names to real ids —
`serviceIds`/`countries` are empty arrays (not an error) if nothing matched, `state` is `null` if
none was clearly implied (free text, not validated against a list — same posture as the manual
write flow). **Errors:** `401` · `403` client account · `400` validation (missing/invalid
`payload`, unsupported source file type) · `503` AI drafting not configured
(`AI_PROVIDER`/`AI_MODEL`/matching API key unset) or the provider call itself failed — manual
article writing is unaffected either way. Every attempt (success or failure) is also recorded,
fire-and-forget, into `ai_draft_generations` (logging the **inferred** `serviceIds`/`countries`/
`state`, not client input — there is no client input for these anymore) — see
`docs/database-erd.md`.

### `member` `POST /v1/articles/ai-refine`

The wizard's inline "refine" box — re-prompts the model against the *current* draft plus the
member's requested changes, returning a complete revised draft (not a diff). Plain JSON, unlike
`ai-draft` above (no files here).

**Request:** `RefineArticleDraftRequest` — `title`, `body` (the current draft), `refinementNotes`
(required), `tone` (optional, e.g. "More formal").

**Response `201`:** `AiDraftArticleResponse` — `serviceIds`/`countries`/`state`/`sources` are
absent here (optional on the shared type for exactly this reason): refine never re-infers taxonomy
or re-fetches citations, only `title`/`body` change. The wizard's review screen keeps whatever the
member last had selected across a refine. **Errors:** same as `ai-draft` above.

### `member` `POST /v1/articles/suggest-topics`

The write-it-yourself form's "Stuck? Try a topic" chip row — a real model call (one `generateText`
call via the same fixed `AI_PROVIDER`/`AI_MODEL`), regenerated on demand via the chip row's
"More ideas" action. Not the AI wizard's draft flow — this only ever returns title ideas, never a
body.

**Request:** `SuggestTopicsRequest` — `serviceIds` optional. With none given (the form's first
render, before any service is selected), the backend samples 3 random active services itself
rather than requiring a selection first.

**Response `201`:** `SuggestTopicsResponse` — `{ topics: string[] }`, up to 6 ideas. **Errors:**
`401` · `403` client account · `503` AI drafting not configured or the provider call failed (same
causes as `ai-draft`).

### `member` `GET /v1/articles/cover-images`

The write flow's "auto-selected cover image" (both paths) — proxies a live Unsplash search so
`UNSPLASH_ACCESS_KEY` never reaches the client. Registered before the `GET /v1/articles/:id` route
below for the same reason as `me` — otherwise `:id` would swallow the literal path segment.

**Query params:** `query` (optional) — free text, typically the selected practice area name(s)
joined with a space; omitted/blank falls back to a generic finance/legal query so the form still
has an image before any practice area is chosen.

**Response `200`:** `CoverImageSuggestionsResponse` — `{ images: string[] }`, up to 5 URLs. The
frontend cycles through these client-side for "Try another image" rather than re-querying on every
click. **Errors:** `401` · `403` client account · `503` `UNSPLASH_ACCESS_KEY` not set or the
Unsplash call failed.

### `member` `POST /v1/articles`

Creates an article, submitted (see below) immediately unless `status: 'draft'` is sent.
`@Roles('member')` — `admin` passes too via `RolesGuard`'s ranked model (admin rank ≥ member
rank); `client` is rejected. Unlike `POST /v1/applications`, this doesn't need an exact-role
check — "member or admin" fits the ranked model directly.

**Request:** `CreateArticleRequest` (see `packages/shared-types/article.ts`). Notably:
- `authorId` is never accepted from the client — always the caller's own id.
- `status` — optional, `'draft' | 'published'`. Sending `'draft'` (or a resulting status of
  `'draft'` on `PATCH`) saves a work-in-progress draft. **Anything else (including omitting the
  field) means "submit it"** — the actual resulting status (`published` vs. `pending_review`) is
  resolved server-side from the `ARTICLES_REVIEW_MODE` env var (`instant` default | `editorial`;
  see `docs/database-erd.md`), never chosen directly by the client. A `draft` skips the
  word-count check below entirely (re-checked whenever it's later submitted).
- `countries` — required, min 1 entry; genuinely multi-select (see `docs/database-erd.md`), free-
  form country names, not ids.
- `creationMode` — optional, `'manual' | 'ai'`, purely descriptive of which authoring path
  produced the row (defaults `'manual'`); not an authorization signal, so accepting it directly
  from the client is fine.
- `aiGenerationId` — optional UUID (added 2026-10-04, additive), the `generationId` from the
  `ai-draft` response the article was saved from. Must belong to the caller (`400` otherwise); an
  id with no matching row is tolerated and saved as `null` (the audit insert is fire-and-forget
  and may have failed — that must never block saving). When set, `creationMode` is forced to
  `'ai'`. `POST` only — not part of `UpdateArticleRequest`, and `PATCH` never changes the link.
- `excerpt`, `readTimeMinutes` are never accepted — always server-derived from `body`.
- `body` must be 800–2000 words (from the design's own "Write it yourself" validation copy) —
  only enforced when the resulting status isn't `'draft'` — checked in `ArticlesService`, not
  expressible as a class-validator decorator for a single field.
- `serviceIds` validated against a live, `is_active`-filtered `services` query before insert — same
  load-bearing check as applications' `servicePreferences`; see `docs/database-erd.md`. Any id that
  resolves to an `isCustom` service requires a matching entry in `customServiceLabels`.

**Response `201`:** `ArticleDto`. **Errors:** `401` no/invalid token · `403` client account · `400`
validation failure (malformed body, word count out of range, invalid/inactive service id, empty
`countries`).

### 🔒 `PATCH /v1/articles/:id`

Partial update. `@Roles('member')` rejects `client` at the guard layer; a finer-grained check in
`ArticlesService` then requires the caller be the article's own author **or** `admin` — anyone else
gets `403`. Owner or admin may also change `status` here (self-service unpublish, or resubmitting
a `rejected` article — same `'draft'` vs. "submit" resolution as `POST` above; a fresh submission
clears any earlier `rejectionReason`). There's no separate moderation endpoint for this — approve/
reject only happens via `GET`/`PATCH /v1/admin/articles` below, in `editorial` review mode.

**Request:** `UpdateArticleRequest` — all fields optional; only provided fields change. `body`,
`serviceIds`, `countries` re-validated the same way as `POST` if present; `excerpt`/
`readTimeMinutes` re-derived if `body` changes.

**Response `200`:** `ArticleDto`. **Errors:** `401` · `403` not the owner and not admin · `404` not
found · `400` validation failure.

### 🔒 `DELETE /v1/articles/:id`

Same owner-or-admin check as `PATCH`.

**Response `204`.** **Errors:** `401` · `403` not the owner and not admin · `404` not found.

### 🛡️ `manageArticles` `GET /v1/admin/articles`

The editorial review queue's list view — only ever non-empty when `ARTICLES_REVIEW_MODE=editorial`
(in `instant` mode nothing ever reaches `pending_review`). Same guard chain and shape as
`GET /v1/admin/applications`: `@Roles('admin')` (freshly re-checked by `RolesGuard`) +
`@RequiresPermission('manageArticles')` (freshly re-checked by `AdminPermissionGuard` against the
admin's `admin_role`).

**Query params:** `status` (optional) — narrows to one bucket (e.g. `?status=rejected` to audit
past decisions); omit for the default queue (`pending_review`).

**Response `200`:** `AdminArticleListItemDto[]` — lighter than `ArticleDto` (no `body`), newest
first. Carries `aiGenerationId: string | null` (added 2026-10-04, additive) — set when the article
was saved from an AI draft; links to `GET /v1/admin/ai-generations/:id` below.

### 🛡️ `manageArticles` `PATCH /v1/admin/articles/:id`

Approve (→ `published`) or reject (→ `rejected` + `rejectionReason`) an article that's currently
`pending_review`. Same guard chain as the `GET` above.

**Request:** `AdminArticleReviewRequest` — `status: 'published' | 'rejected'`, `rejectionReason`
required when rejecting.

**Response `200`:** `ArticleDto`. **Errors:** `401` · `403` not admin or lacks `manageArticles` ·
`400` article isn't `pending_review`, or rejecting without a reason.

### 🛡️ `manageArticles` `GET /v1/admin/ai-generations`

The admin AI-generations log — one row per `POST /v1/articles/ai-draft` attempt (success or
failure), read from `ai_draft_generations` (see `docs/database-erd.md`). Read-only. Same guard
chain as `GET /v1/admin/articles`: `@Roles('admin')` + `@RequiresPermission('manageArticles')`.

**Query params:** `status` (optional, `success | failed`), `authorId` (optional UUID). Anything
else is rejected (`forbidNonWhitelisted`).

**Response `200`:** `AdminAiGenerationListItemDto[]`, newest first, **capped at the 200 most
recent** (no pagination yet) — `id`, `authorId`, `authorName`, `status`, `draftTitle` (null when
failed), `provider`, `model`, `latencyMs`, `errorMessage`, `article` (`{ id, title, status }` of
the article saved from it via `articles.ai_generation_id`, or `null` if never saved), `createdAt`.

### 🛡️ `manageArticles` `GET /v1/admin/ai-generations/:id`

Full detail of one attempt: everything the member gave the wizard next to what the AI returned.
Same guard chain as above.

**Response `200`:** `AdminAiGenerationDetailDto` — the list-item fields above, plus:
- `inputs` — `notes`, `recentDevelopments`, `advice` (step 1); `followUps: { question, answer |
  null }[]` (every question the AI asked, in order — `answer: null` means the member skipped it);
  `sourceLinks`; `sourceFiles: { filename, url | null }[]` (`url` is a **10-minute signed URL**
  into the private `ai-draft-sources` bucket, `null` if the object can't be signed); `includeVisual`,
  `tone`, `extraInstructions` (step 3).
- `output` — `title`, `body` (re-sanitized with the article allowlist before returning, since the
  admin page renders it as HTML), `sources` (citations), `services` (AI-inferred ids resolved to
  `ArticleService`, unknown ids dropped), `countries`, `state`. All null/empty for a failed attempt.

`output` is the AI's **original** draft. Later `ai-refine` passes and the member's own edits
before saving aren't logged — compare against the linked `article` for the saved version.

**Errors:** `401` · `403` not admin or lacks `manageArticles` · `400` `id` isn't a UUID · `404`
not found.

## Articles — not built yet (explicitly deferred)

- Admin AI-generations log: pagination beyond the 200 most recent, and logging `ai-refine` passes
  (only the original `ai-draft` output is recorded today).

- Tags, AI-generated summary bullet points, view/like/comment counters — none of these are real
  persisted per-article data (tags are a cosmetic, client-derived suggestion shown during writing,
  never saved — matches the prototype's own tags-are-UI-only behavior; summary points are a
  static seed-data lookup; engagement is anonymous `localStorage` state in the prototype) — out of
  scope for this contract.
- `category`/`country` query-param filtering on `GET /v1/articles` — the prototype (and this
  build) filter client-side over the full published set; not built server-side yet.
- Email/notification when an article is approved or rejected — no email infrastructure exists yet
  (root CLAUDE.md's "not yet applicable" list); the author finds out by checking My Articles.

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

## Events — admin

🛡️ `manageEvents` on every route below — same posture as Membership applications admin: base
`admin` role re-checked fresh (`RolesGuard`), then `admin_role` re-checked fresh against the
`manageEvents` permission (`AdminPermissionGuard`). Direct admin CRUD only — no public
suggestion-queue submission endpoint exists yet (see "Not built yet" below).

### 🛡️ `manageEvents` `GET /v1/admin/events`

Every event regardless of `status` (draft and published), chronological by `start_date` — same
ordering as the public browse list, just not status-filtered. Backs the admin list at
`/admin/events`.

**Response `200`:** `EventDto[]`.

### 🛡️ `manageEvents` `GET /v1/admin/events/:id`

Single event, any status. Backs the admin edit page's prefill — no public by-id endpoint exists
to reuse (the public route only ever needed list shapes).

**Response `200`:** `EventDto`. **Errors:** `404` not found.

### 🛡️ `manageEvents` `POST /v1/admin/events`

Creates an event. Slug is generated server-side from `title` (never client-writable, same
posture as article slugs).

**Request:** `CreateEventRequest`. `status` optional — **omitting it defaults to `'draft'`**,
matching the `events.status` column's own default; the admin form always sends an explicit
draft-or-publish choice, so this only matters as a safety net. A draft only needs `title`,
`description`, `startDate` (the DTO's unconditional requireds) — see **Publish requirements**
below for what else is enforced when `status: 'published'`.

**Response `201`:** `EventDto`. **Errors:** `401` no/invalid token · `403` not admin or missing
`manageEvents` · `400` validation failure (including publish requirements, see below).

### 🛡️ `manageEvents` `PATCH /v1/admin/events/:id`

Partial update — only provided fields change, including `status` (draft ⇄ published).

**Request:** `UpdateEventRequest`. **Response `200`:** `EventDto`. **Errors:** `401` · `403` ·
`404` not found · `400` validation failure (including publish requirements, see below).

**Clearing an optional field:** every optional field accepts `null` in addition to its normal
type. An **omitted** key leaves that column unchanged (standard partial-update semantics); an
**explicit `null`** clears it. This distinction only matters for `PATCH` — on `POST` the two are
equivalent, since `EventsService.create()` falls back to `?? null` either way.

#### Publish requirements

`title`, `description`, and `startDate` are always required (DTO-level `@IsNotEmpty`). The
remaining fields are optional on a DTO level — a draft can omit all of them — but are enforced by
`EventsService` (`apps/backend/src/events/publish-requirements.ts`) whenever the event's *effective*
status resolves to `'published'`: `organiserName`, `endDate`, `eventFormat`, `eventType`, `city`,
`country`, `registrationUrl`. "Effective" means `dto.status ?? <current row's status for PATCH>`
checked against the *merged* fields (existing row's values patched with whatever this request
provides) — not just what's present in a single request body. This closes two gaps a pure
per-request check would miss: publishing a draft that already has some fields set via a prior save
(PATCH `{status: 'published'}` alone must still see those fields), and a status-less PATCH against
an already-published event trying to blank out a required field (e.g. `{city: ''}`).

On failure: `400` with one message per missing field (e.g. `"Organizer is required to publish an
event."`), same array-of-strings shape as class-validator's own errors.

### 🛡️ `manageEvents` `DELETE /v1/admin/events/:id`

**Response `204`.** **Errors:** `401` · `403` · `404` not found.

### 🛡️ `manageEvents` `GET /v1/admin/events/export`

Streams every event (any status) as a CSV file (`Content-Type: text/csv`, `Content-Disposition:
attachment; filename="events.csv"`). Columns, in order: `id, title, slug, description,
shortDescription, coverImageUrl, startDate, endDate, timezone, eventType, eventFormat, country,
city, venueName, isFree, registrationUrl, organiserName, status, createdAt, updatedAt`. Re-uploading
this file unmodified to `POST /v1/admin/events/import` is a no-op (every row matches its own `id`
and gets rewritten to the same values).

### 🛡️ `manageEvents` `POST /v1/admin/events/import`

Bulk create/update/delete via a CSV upload (`multipart/form-data`, field `file`). `.csv` only today
— `.xlsx`/Excel support is deferred, not silently dropped.

**Semantics — each row is the full desired state of one event (a replace, not a partial patch),
and the whole file is treated as a full sync:**

- `id` blank → creates a new event. `slug` is generated server-side from `title` (never
  client-writable, same as `POST /v1/admin/events`) — any `slug` value in the row is ignored.
- `id` filled and matches an existing event → replaces every column on that row except `slug`
  (slug is permanent once assigned, same as a single `PATCH`).
- `id` filled but matches no existing event, or the same `id` appears on more than one row → row
  error (see below).
- Any existing event whose `id` isn't present anywhere in the file → **deleted**. This is a full
  sync, not an additive import — omitting a row deletes that event.
- Required per row: `title`, `description`, `startDate` (unconditional, same as
  `CreateEventRequest`). If the row's `status` is `published`, the same 7 fields
  `publish-requirements.ts` enforces on a single create/update are re-checked against this row's
  own values (not merged with any existing row — a row stands alone).
- `isFree`: `"true"` or `"false"` (case-insensitive), blank → `false`. `eventFormat`/`status`: must
  be a valid enum value or blank (`status` blank → `draft`). `coverImageUrl`/`registrationUrl`: must
  be a valid URL if present.

**All-or-nothing:** every row is validated before anything is written. If any row fails, **nothing
is written** — `400` with one message per failure, each prefixed `"Row N: ..."` (`N` is the CSV row
number, header counted as row 1), same array-of-strings shape as every other validation error in
this API. A file with zero data rows is rejected outright (`400`) rather than treated as "delete
everything," even though that's what a literal full sync would otherwise do.

**Response `200`** (never `201` — the response is as often all-updates as it is a creation):
```
ImportEventsResponse {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  results: { row: number | null; action: 'created' | 'updated' | 'deleted'; id: string; title: string }[];
}
```
`row` is `null` for a `deleted` action, since a deletion is driven by an id's absence from the file,
not by any specific row in it.

**Errors:** `401` · `403` · `404`/`403`/`401` not applicable beyond the controller-level guard ·
`400` no file / wrong extension / empty file / unparseable CSV / missing required column / zero
data rows / any row validation failure (see above).

**Known limitation — not a single DB transaction:** rows are fully validated before any write, so a
write-phase failure only happens on a rare infra error (not a data problem), and at this table's
scale (dozens of rows) re-running the import is a sufficient recovery path. A literal all-or-nothing
guarantee under a mid-write crash would need a Postgres function wrapping the writes in one
transaction — deliberately not built given the above.

### Not built yet (explicitly deferred)

- Public suggestion queue + admin approve/reject moderation of those suggestions
  (`POST /v1/events/suggestions`, admin review endpoints) — `status` already supports the
  underlying state, but no submission endpoint exists yet. The `/events` page's "Suggest an
  event" card remains a `mailto:` link. Direct admin add/edit/delete (above) is built; the
  public-submission half of US-13-01 is not.
- `.xlsx`/Excel upload support for `POST /v1/admin/events/import` — CSV only today, by deliberate
  scope decision, not an oversight.
- A frontend import/export UI on `/admin/events` — this session built and verified the backend
  contract only (curl, per this repo's backend/frontend session split); wiring an upload button and
  a "Download CSV" link into the admin page is separate frontend scope.
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

**Query params:** `q` (case-insensitive substring match across name, headline, bio, firm,
city/state/country, and the names of the member's services or their categories), `serviceId` (repeatable),
`categoryId` (single — broadens to "any service in this category"; combined with `serviceId`, both
must match), `country` (repeatable), `rateMinCents`/`rateMaxCents`, `sort`
(`featured`\|`newest`\|`tenure`\|`rate_asc`\|`rate_desc`, default `featured`), `page`/`pageSize` (default
`pageSize=8`, matching the prototype's infinite-scroll page size; **max 50**). Validated
(2026-10-29): `q` ≤ 100 chars, `serviceId`/`categoryId` UUIDs, at most 20 `serviceId`/`country`
values, integer rates, a known `sort` — anything else is `400 VALIDATION_FAILED`. Filtering,
search, sorting and paging run in one SQL function (`member_directory_ids`), so every page is full
and the request size never grows with the data.

**Response `200`:** `MemberListItemDto[]` — id, slug (added 2026-09-27; server-generated, unique,
permanent — the key for `GET /v1/members/:slug` and the frontend's `/members/[slug]` route), name, initials, headline, bio, firmName,
region, country, city, services (`{id, name, categoryId, categoryName}[]`, from `member_services`),
isVerified, memberTier, yearsOfExperience, rateMinCents, rateMaxCents, rateCurrency, photoUrl, joinedAt (membership start timestamp).
`sort=newest` orders by membership start descending, with profile ID as a stable tie-breaker.
Tenure/rate display strings
(`"18y"`, `"$420/hr"`) are **not** returned — format them client-side from the numeric fields.
`bio` is the full field (not pre-truncated) — the directory card excerpt is a client-side
`line-clamp-2`, matching the design's own approach, so no separate excerpt field was added.

### 👤 `GET /v1/members/me/profile`

*Added 2026-10-23.* The signed-in member's own profile handle — **Response `200`:**
`MyMemberProfileDto` (`{ id, slug }`, `packages/shared-types/member.ts`). `404` when the caller has
no member profile; `403` for clients. Two path segments, so it can never collide with a slug read.
Backs the frontend's `/members/me` route, which redirects to `/members/<slug>` (the home hero's
"View my profile" button for members).

### 🔒 `GET /v1/members/:slug`

**Keyed on the member's slug, not the UUID** (e.g. `/v1/members/priya-menon`) — changed in place on
`/v1` on 2026-09-27 as a deliberate exception to the "breaking changes go to `/v2`" rule: the
frontend was the only caller, both ship together, and the feature wasn't live yet. A UUID passed
here is treated as a (non-matching) slug and returns `404`. Every other member route below — the
owner-only `/:id/uploads` and `/:id/edits`, and admin `PATCH /v1/admin/members/:id` — stays keyed on
the UUID (`MemberDto.id`): those compare it directly against the caller's JWT, never appear in the
browser's address bar, and the UUID remains the key every other table references.

Full profile — all `member_profiles` columns (incl. `workEmail`, added 2026-10-10), all 8 child arrays, `memberServices`. List items carry `isVerified`; `proofAttachments` appear on items **only for the owner/admins**. Work history is returned newest-first. **Requires
sign-in** (any authenticated role) — a deliberate product decision, not something the static
prototype itself consistently enforces; see `docs/database-erd.md`'s "Design decisions" note.

A member's own published articles are **not** embedded here — fetch
`GET /v1/articles?authorId=:id` separately (see that endpoint's note above). `memberServices`
resolves service (and category) names the same way `ArticleService` does.

**Response `200`:** `MemberDto`. **Errors:** `401` no/invalid token · `404` no member with that slug, not
`status='active'`, or the caller isn't its owner (same "don't leak existence" posture as a draft
article — a deactivated profile that isn't the caller's own returns `404`, not `403`).

### 🔒 `POST /v1/members/:id/uploads`

Requests a signed upload URL for a proof file or a key-client logo — Supabase Storage bucket
(`member-proofs`), member uploads directly to the returned URL, this endpoint never sees file
bytes. `@Roles('member')`, owner-only (`:id` must equal the caller's id).

**Request:** `{ fileName: string (≤200 chars), contentType: 'application/pdf' | 'image/jpeg' |
'image/png' | 'image/webp' | 'image/gif' }` — the bucket enforces the same type list and a 10MB cap
on the upload itself, and `POST /v1/members/:id/edits` re-sniffs every referenced file's magic bytes
(`400 UPLOAD_INVALID_TYPE` / `UPLOAD_TOO_LARGE`), so the declared type is never trusted alone.
**Response `201`:** `{ uploadUrl: string,
path: string }` — for the batch-shared-proof sections (`education`, `work_experiences`), `path`
gets sent back as top-level `proofFileUrl`; for `key_clients`, as that row's `logoUploadPath`; for
the per-item-proof sections (`engagements`, `testimonials`, `awards`), as the `url` of a `{ type:
'file', url, label }` entry appended to that row's `proofAttachments` (see below) — call this
endpoint once per file when a member attaches multiple.

### 🔒 `POST /v1/members/:id/edits`

Submit a self-edit proposal for one section. `@Roles('member')`, owner-only (service-layer check,
same pattern as `PATCH /v1/articles/:id`'s owner-or-admin check but stricter — no admin bypass
here, since this is a submission, not a direct write). Creates a `pending` `member_profile_edits`
row; **never touches the live profile** — that only happens on admin approval (see below).

**Request:** `CreateMemberEditRequest` — `{ section, payload, proofFileUrl?, proofLink? }`.

**Updated 2026-10-10 (additive):** proof is **optional everywhere** for members. Payload items may
carry `id` (the live item's id when editing an existing item — keep it so a rejected change falls
back to the live version and the id stays stable); `isVerified` is server-owned and ignored. Live
items now return their `proofAttachments` to the owner so the edit modal can prefill them. New
per-section validation (`400` with `{ code, message }`): `engagements` — `clientName` required
(`ENGAGEMENT_CLIENT_NAME_REQUIRED`), `clientEmail?` valid email (`ENGAGEMENT_CLIENT_EMAIL_INVALID`),
`verificationMethods?` unique subset of `engagement_letter|client_deliverable|mail_confirmation_pdf|newsletter_transaction_update|other`
and `verificationMethodOther?` ≤ 300 chars (`ENGAGEMENT_VERIFICATION_METHODS_INVALID`);
`testimonials` (2026-10-21) — optional `clientEmail?` valid email (`TESTIMONIAL_CLIENT_EMAIL_INVALID`),
for the team's random verification. **`clientEmail` on engagements and testimonials is owner/admin-only
in `GET /v1/members/:slug`** (omitted for every other viewer, like `proofAttachments`) — it's a
third party's address;
**URLs** (2026-10-29) — `contact.linkedinUrl`, `contact.website`, `engagements[].url`,
`key_clients[].logoUrl`, every `proofAttachments[]` entry of type `link`, and the edit-level
`proofLink` must be http(s) addresses (a scheme-less `www.firm.com` is accepted and read as https);
`javascript:`/`data:`/other schemes are rejected with `400 URL_INVALID` (`proofLink`: standard
validation `400`) — these render as links on the public profile and the admin review screen;
`key_clients` — max 20 items (`KEY_CLIENTS_LIMIT_EXCEEDED`), `name` required (`KEY_CLIENT_NAME_REQUIRED`),
optional `proofAttachments`; `work_experiences` — `startYear` int, `isCurrent` bool, optional
`startMonth`/`endMonth` 1-12, no end-before-start (`WORK_HISTORY_END_BEFORE_START`); overlapping
ranges allowed (2026-10-21); stored newest-first; `contact` — adds `workEmail`, emails must be
valid (`CONTACT_EMAIL_INVALID`). Other codes: `PAYLOAD_NOT_ARRAY`, `PAYLOAD_ITEM_INVALID`,
`HEADLINE_BIO_INVALID`, `CONTACT_PAYLOAD_INVALID`, `PROOF_ATTACHMENTS_INVALID`, `WORK_HISTORY_INVALID`. Shape of
`payload` depends on `section` (see `packages/shared-types/member.ts` for the per-section
discriminated union) and matches the section's actual base-data shape — **not** the prototype's
flattened single-string-per-item shortcut (see `docs/database-erd.md`).

Proof shape also depends on `section`: `education`/`work_experiences` use the top-level
`proofFileUrl`/`proofLink` (one shared proof for the whole batch); `engagements`/`testimonials`/
`awards`/`key_clients` instead carry proof **per item**, as `payload[i].proofAttachments?:
{type: 'file'|'link', url, label}[]` — a member can attach any mix of multiple files and links to
a single item, not just one or the other. The DTO only validates `payload` is present (its exact
shape is section-dependent, so class-validator can't express it) — `MembersService
.validateEditPayloadShape()` does the real per-section check, including that every
`proofAttachments` entry (when present) has a valid `type`/`url`/`label`. `proofAttachments` is
private evidence: since 2026-10-10 it is **kept** on the live item (so editing prefills it) but is only returned to the item's owner and admins, never to other viewers of `GET /v1/members/:slug`.

**One pending edit per section.** Submitting closes any older still-`pending` edit for the same
member + section (status `rejected`, `reviewNote: "Replaced by a newer submission."`,
`reviewedBy: null` — a null reviewer is how clients tell "replaced" apart from a real rejection),
so an admin can never approve a stale request over a newer one.

**File paths must be the member's own.** Every storage path the edit references — `proofFileUrl`,
`proofAttachments[].url` where `type: 'file'`, and key-client `logoUploadPath` — must start with
`<memberId>/` (where `POST /v1/members/:id/uploads` puts them). Otherwise `400`: a member could
otherwise point at someone else's private proof and have it signed for an admin, or copied into
the public bucket as a "logo".

**Response `201`:** `MemberProfileEditDto`. **Errors:** `401` · `403` not this member · `400`
validation failure (payload shape doesn't match `section`, a malformed `proofAttachments` entry, or
a file path that isn't the member's own).

### 🔒 `GET /v1/members/:id/edits`

Owner's own edit requests, any status, newest first — drives the "pending verification" badge.
Owner-only, same posture as `GET /v1/articles/me`.

**Response `200`:** `MemberProfileEditDto[]`.

### 🔑 `PATCH /v1/members/:id`

Added 2026-10-21. The member updates their **directly-editable** fields — any combination in one
request, at least one (`400 NOTHING_TO_UPDATE`). Owner-only (`:id` must be the caller — `403`
otherwise). Applies **immediately**, no moderation queue (product decision). Vetted profile content
(bio, engagements, clients, testimonials, …) is not here — it goes through `POST /v1/members/:id/edits`.
(Briefly shipped as separate `PATCH /v1/members/:id/availability` and `…/photo` routes on 2026-10-21;
consolidated here the same day, before any external consumer — not a `/v2`-worthy break.)

**Request:** `UpdateMemberRequest`, every field optional:
- `isAvailable?: boolean` — the "Available for consultations" switch (profile sidebar + mobile CTA
  bar). Previously a DB default (`true`) no one could change.
- `availabilityNotes?: string | null` — ≤ 200 chars, shown under the status; omit to keep, `null`
  or `""` to clear.
- `photoUploadPath?: string` — new profile photo. Upload the (cropped) image first with
  `POST /v1/members/:id/uploads` (signed URL into the private `member-proofs` bucket), then send the
  returned `path` (must start with `<id>/`). Magic-byte checked: JPEG, PNG or WebP only
  (`400 PHOTO_INVALID_TYPE`), ≤ 5MB (`400 PHOTO_TOO_LARGE`). Copied to a fresh public path in
  `application-assets` (`members/<id>/profile-photo-<uuid>.<ext>`) so caches never serve the old one.

All validation runs before anything is written — a rejected photo leaves availability unchanged.

**Response `200`:** the updated `MemberDto` (same shape as `GET /v1/members/:slug` for the owner).
**Errors:** `400` validation · `403` not your profile · `404` no member profile.

### 🛡️ `manageMembers` `GET /v1/admin/members`

All members, including `deactivated`, unfiltered by the public directory's `status='active'`
constraint.

**Response `200`:** `MemberListItemDto[]` plus `status`, `applicationId`,
`membershipStartedAt`, `renewalPaymentStatus`, `renewalDueState` (computed
`active`\|`due-soon`\|`overdue` from `membershipStartedAt` plus a hardcoded 12-month period / 30-day
reminder window — see `docs/database-erd.md`).

### 🛡️ `manageMembers` `PATCH /v1/admin/members/:id`

Admin override of `status`, `membershipStartedAt`, `renewalPaymentStatus`. Does not touch anything
the self-edit flow governs (headline, bio, child tables, etc.) — that's `member-edits` below, kept
separate so "admin corrects a lifecycle fact" and "member requests a content change" stay distinct
audit trails.

**Response `200`:** the updated admin member record (same shape as one row of `GET
/v1/admin/members`).

### 🛡️ `manageMembers` `GET /v1/admin/member-edits`

Edit requests across every member, newest first. Query param `status`: `pending` (default) \|
`verified` \| `rejected` \| `all` — anything else is `400`. The admin queue page
(`/admin/member-edits`) fetches `all` and groups by member client-side.

**Response `200`:** `MemberProfileEditDto[]`. Every `MemberProfileEditDto` (here and on the
member's own endpoints) carries `memberName`, and since 2026-09-27 also `memberSlug` and
`memberPhotoUrl` (additive).

### 🛡️ `manageMembers` `GET /v1/admin/members/:id/edits`

Added 2026-09-27. Everything the per-member review page (`/admin/member-edits/[memberId]`) needs,
in one call. `:id` is the member's UUID (`400` if malformed, `404` if no such member — any
`status`, including deactivated).

**Response `200`:** `AdminMemberEditsDetailDto`:
- `member` — `{ id, slug, name, initials, email, photoUrl, status, isVerified }`.
- `current` — the **live** value of every self-editable section, keyed by section name
  (`headline_bio: {headline, bio}`, `contact: ContactEditPayload`, and the six list sections as
  their public item arrays), for the current-vs-proposed diff.
- `edits` — all of this member's edits, any status, newest first.
- `fileUrls` — storage path → signed download URL (1-hour expiry) for every private
  `member-proofs` object those edits reference. A path missing from the map couldn't be signed
  (e.g. the member deleted it); the UI shows it as unavailable.

### 🛡️ `manageMembers` `PATCH /v1/admin/member-edits/:id`

Review one edit request. Two modes:

**1. Whole-edit** (`headline_bio`, `contact`, or legacy array behaviour): `{ status: 'verified' |
'rejected', reviewNote?: string }` — `reviewNote` required (non-blank) when rejecting (`400
REVIEW_REASON_REQUIRED`). On `verified` for an array section without `items`, every item is
accepted, `isVerified` = the item has proof.

**2. Per-item** (array sections, added 2026-10-10): `{ items: [{ index, decision, reason? }], reviewNote? }`.
`items` must cover **every** payload index exactly once (`ITEM_REVIEW_INCOMPLETE`,
`ITEM_REVIEW_INDEX_INVALID`). `decision`:
- `approved_verified` — applied, live **with** the Verified badge (`isVerified: true`). The item must
  have proof: its own `proofAttachments` (engagements/testimonials/awards/key_clients) or the
  edit-level `proofFileUrl`/`proofLink` (education/work_experiences), else `400 VERIFIED_REQUIRES_PROOF`.
- `approved_hygiene` — applied, live **without** the badge. `reason` required (shown to the member,
  e.g. "proof not attached"), else `400 ITEM_REVIEW_REASON_REQUIRED`.
- `rejected` — not applied. `reason` required. If the payload item carried a live `id`, that live
  item stays untouched; a brand-new item is dropped.
`status` may be omitted; the edit's status is derived: `verified` if any item was accepted, else
`rejected`. A supplied `status` that contradicts this is `400 REVIEW_STATUS_MISMATCH`. Per-item
mode on `headline_bio`/`contact` is `400 ITEM_REVIEW_NOT_SUPPORTED`; neither `status` nor `items`
is `400 REVIEW_DECISION_REQUIRED`. The decisions are stored on the edit as `itemReviews`
(`[{index, decision, reason}]`) and returned in `MemberProfileEditDto.itemReviews` (null for
whole-edit reviews) so the member sees each item's reason. If every item is rejected the live
section is left exactly as it was (including items the member had removed). Accepted items keep
`proofAttachments`. Work history is re-validated (end-before-start) and re-sorted on apply; overlaps with
retained live items are allowed. `contact`
approval now also writes `workEmail`. No email is sent.

**Key-client logos are published on approval.** A newly uploaded logo sits in the private
`member-proofs` bucket as the item's `logoUploadPath`; the public profile reads `logoUrl`. On
approval the file is magic-byte checked (PNG/JPEG/WebP/GIF, ≤ 2MB), copied to the public
`application-assets` bucket at `members/<memberId>/client-logos/<uuid>.<ext>`, and `logoUrl` is set
to its public URL; `logoUploadPath` is dropped. Items without a new upload keep their existing
`logoUrl`. (Before this, approved logos were silently lost — written as `logoUploadPath`, which
nothing reads.) A logo that fails the check makes the whole approval `400` with a message naming
the client — reject the edit with a reason instead.

**Response `200`:** `MemberProfileEditDto`. **Errors:** `400` (codes above), or
an invalid key-client logo · `409` if the edit is no longer `pending` (already reviewed, or
replaced by a newer submission).

### 🔒 `GET /v1/members/:id/recommendations`

Added 2026-10-10. `:id` = recommended member's UUID (`MemberDto.id`). Any signed-in role. Returns
non-hidden recommendations newest first; the recipient and admins also receive hidden ones
(`isHidden: true`). **Response `200`:** `MemberRecommendationDto[]` — `{ id, recipientId, author:
{ id, slug, name, initials, photoUrl }, body, isHidden, createdAt }`. **Errors:** `404` unknown or
non-active member (the owner can still read their own).

### 🔑 `POST /v1/members/:id/recommendations`

`@Roles('member')`. The caller must be an **active member** writing for **another active member**.
**Request:** `{ body: string }` (10–2000 chars, trimmed, plain text). Published immediately.
**Response `201`:** `MemberRecommendationDto`. **Errors:** `400` validation · `403`
`RECOMMENDATION_SELF` (recommending yourself) or `RECOMMENDATION_AUTHOR_NOT_ACTIVE_MEMBER` ·
`404` `RECOMMENDATION_RECIPIENT_NOT_FOUND` (not an active member) · `409`
`RECOMMENDATION_ALREADY_EXISTS` (one per author/recipient pair).

### 🔑 `PATCH /v1/members/:id/recommendations/:recommendationId`

`@Roles('member')`, only the **recommended member** (`:id` must equal the caller). **Request:**
`{ isHidden: boolean }` — hide/unhide. **Response `200`:** `MemberRecommendationDto`. **Errors:**
`403` caller isn't the recipient · `404` recommendation not found under this member.

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

## Consultations

Two resources: `consultation_requests` — a client or member requesting time with a member — and
`consultation_messages`, a free-form back-and-forth thread on a request (added by a later product
requirement; direct contact via `mailto:`/`tel:` was the only option at this doc's original
writing). No time-slot scheduling, no rate/payment (per `docs/roadmap.md`'s read of the prototype —
not added without a product decision). A service/category picker (not in the original design
prototype) was added by a later product requirement — see `POST /v1/consultations` below.

### 🔑 `GET /v1/consultations/can-request/:memberId`

Read-only probe the frontend calls before even opening the request form — reports both gates
`POST /v1/consultations` enforces (see below): the pending-duplicate cooldown (checked first) and
the daily rate limit, without requiring the caller to fill out and submit the form first to find
out which one, if either, applies. `memberId` isn't validated as a real member here (a bad id just
can't have a pending request, so `blocked` comes back `false` from that check) — this endpoint is
a cheap read scoped to the caller's own `requester_id`, not a gate.

**Response `200`:** `{ blocked: boolean; reason: 'pending' | 'rate_limited' | null; retryAfter:
string | null }` — `reason`/`retryAfter` are set whenever `blocked` is `true`; `retryAfter` is the
pending request's cooldown end for `'pending'`, or the rate-limit window's reset time for
`'rate_limited'`. **Errors:** `401` no/invalid token.

### 🔑 `POST /v1/consultations`

Creates a request. Any authenticated role — client, member, or admin — may send one, including to
a member who is themselves a signed-up member (peer-to-peer) — the prototype's own creation flow
never actually restricts this despite its inbox view implying a client/member distinction. Whether
admin accounts should be able to create requests (e.g. for support/testing purposes) hasn't had an
explicit product decision — current behavior simply doesn't restrict it.

The target `memberId` must resolve to a `profiles.role === 'member'` row whose `profiles.status`
is `active` and whose `member_profiles.status` is also `active` — a deactivated/suspended member
is rejected with the same `400`/message as a non-existent or non-member `memberId`, so a caller
can't distinguish "no such member" from "that member is deactivated."

Exactly one of `serviceId`/`customServiceLabel` is required. `serviceId` must be one of the
target member's own offered services (validated server-side against `member_services` — an
arbitrary `services.id` the caller doesn't actually offer is rejected with `400`); otherwise
`customServiceLabel` (free text, max 150 chars) is used. `message` requires a minimum of 100
characters — a quality bar for the member deciding whether to accept, not just formatting
validation.

Rate-limited: `CONSULTATION_REQUEST_LIMIT` (default `3`) requests per
`CONSULTATION_REQUEST_WINDOW_DAYS`-day (default `1`) window, counted across all target members, not
per-member. Windows are fixed-size blocks anchored to 08:00 UTC, not a rolling clock — see
`docs/superpowers/specs/2026-10-01-consultations-backend-design.md` §4 for the exact math. A
multi-day window (`CONSULTATION_REQUEST_WINDOW_DAYS > 1`) anchors to the fixed epoch
`1970-01-01T08:00:00Z`, so e.g. a 7-day window resets on a fixed weekday (Thursdays at 08:00 UTC)
determined by that epoch, not by when the server first started or when any particular user signed
up. The rate-limit check is a count-then-insert read followed by a separate write, not atomic — a
burst of truly concurrent requests from the same user could narrowly exceed the configured limit;
this is an accepted, intentional tradeoff (a soft abuse guard, not a hard limit), not a bug.

Separately, a **pending-duplicate cooldown**: if the caller already has a `'pending'` request to
this same `memberId`, a new one to that member is rejected until either the member decides it
(`completed`/`declined`) or `CONSULTATION_PENDING_COOLDOWN_DAYS` (default `15`) days have passed
since it was sent, whichever comes first — the cooldown expiring on its own means a member who
never responds doesn't block the requester forever. This is per-(requester, member) pair and
independent of the rate limit above (a global per-requester count); a caller can be blocked by one
without the other — checked in that order (cooldown, then rate limit), so when both would apply,
the cooldown's `409` wins. Not atomic with the insert (a read-then-write, same accepted tradeoff as
the rate limit) — a burst of truly concurrent requests to the same member could narrowly both
succeed. See `GET /v1/consultations/can-request/:memberId` above for the pre-flight version of
both checks.

**Request:** `CreateConsultationRequestRequest`. **Response `201`:** `ConsultationRequestDto`.
**Errors:** `401` no/invalid token · `400` validation failure (`VALIDATION_FAILED`, e.g. `message`
under 100 characters), `CONSULTATION_SERVICE_REQUIRED` (neither `serviceId` nor
`customServiceLabel`), `CONSULTATION_SERVICE_NOT_OFFERED` (a `serviceId` the target member doesn't
offer), `CONSULTATION_MEMBER_NOT_FOUND` (`memberId` isn't an active member — one code for missing,
non-member and deactivated alike), `CONSULTATION_SELF` (`memberId === caller.id`) · `409
CONSULTATION_PENDING_EXISTS` caller already has a pending request to this member (body includes
`retryAfter`, the ISO timestamp the cooldown ends) · `429 CONSULTATION_RATE_LIMITED` rate limit
exceeded (body includes `resetAt`, the ISO timestamp the window next resets).

### 🔒 `GET /v1/consultations/mine`

The caller's own sent requests, newest first, enriched with `memberName`/`memberFirmName`/
`memberHeadline`/`memberAvatarUrl`/`memberSlug` (the member they sent each request to) —
`memberSlug` backs the frontend's "View Profile" link — and `serviceName` (resolved from
`services.name` when `serviceId` was set; `null` when `customServiceLabel` was used instead).

**Response `200`:** `ConsultationRequestDto[]`.

### 🔒 `GET /v1/consultations/received`

The caller's received requests, newest first — scoped to `member_id = caller.id`. **The design
prototype (`consultation-requests.html`) has no such filter at all** (shows every request to every
member); this is deliberately not reproduced. Each row is enriched with `requesterIsVerifiedMember`
(computed from `profiles.role`, never client input), `requesterFirmName`, `requesterAvatarUrl`, and
`serviceName` (same resolution as `/mine`, above).

**Response `200`:** `ConsultationRequestDto[]`. **Errors:** `403` caller's role isn't `member`.

### 🔒 `PATCH /v1/consultations/:id`

The one update endpoint for a consultation request, used by **both participants** and authorized
per field (2026-10-21: the requester's rating moved here from the former
`PATCH /v1/consultations/:id/rating`, removed the same day — pre-production, our frontend was the
only caller). A request carries one of two shapes, never both:

- **Decision — the target member only.** `status` (`completed`|`declined`) + `responseMessage`
  (10–500 chars), sent together. `pending` → `completed`/`declined`; no intermediate state, no
  cancel, no re-opening a decided request. The requester sees `responseMessage` on their `/mine`
  list, so a bare status flip with no explanation isn't enough context.
- **Rating — the requester only.** `rating`, integer 1–5, once the member has marked the request
  **completed** (a `declined` request can't be rated — there was no conversation). This replaces
  the now-closed message composer on the requester's side.

**Request:** `UpdateConsultationRequest` (all fields optional). **Response `200`:** `ConsultationRequestDto`.
**Errors:** `401` · `403` wrong participant for the fields sent (decision by a non-member, rating by a
non-requester) · `404` not found · `409` already decided / not `completed` for a rating · `400`
validation, or `NOTHING_TO_UPDATE` (empty body), `MIXED_UPDATE` (decision and rating together),
`DECISION_INCOMPLETE` (`status` without `responseMessage` or vice versa).

### 🔒 `GET /v1/consultations/:id/messages`

Either participant (the requester or the target member on this request) can read the thread,
regardless of `status` — history stays visible after a decision, only posting new messages closes.
Newest-last (chat order).

**Response `200`:** `ConsultationMessageDto[]`. **Errors:** `401` · `403` caller is neither the
request's `requesterId` nor `memberId` · `404` request not found.

### 🔒 `POST /v1/consultations/:id/messages`

Either participant posts a message — only while `status` is `'pending'`. Once the member decides
(`completed`/`declined`), the conversation closes to new messages on both sides; the requester
rates it instead (`rating` on `PATCH /v1/consultations/:id` above).

**Request:** `CreateConsultationMessageRequest` (`body`, 1–2000 chars). **Response `201`:**
`ConsultationMessageDto`. **Errors:** `401` · `403` · `404` · `409` request already decided ·
`400` `body` missing or over 2000 characters.

### 🛡️ `manageConsultations` `GET /v1/admin/consultations`

Every request regardless of status or member, newest first, unpaginated (same posture as
`AdminMembersController.listMembers()`).

**Response `200`:** `ConsultationRequestDto[]`.

### 🛡️ `manageConsultations` `PATCH /v1/admin/consultations/:id`

Same transition as the owner-member route, no ownership check. `responseMessage` required, same
validation as the owner-member route above.

**Request:** `UpdateConsultationStatusRequest`. **Response `200`:** `ConsultationRequestDto`.
**Errors:** `401` · `403` · `404` not found · `409` already decided · `400` `responseMessage`
missing or under 10 characters.

### Not built yet (explicitly deferred)

- `subject`/`description`/`scheduledAt` — schema columns, no UI anywhere in this feature to
  collect or display them. (`serviceId`/`customServiceLabel`/`responseMessage` were schema-only at
  this doc's original writing but are now wired up — see `POST /v1/consultations` and
  `PATCH /v1/consultations/:id` above.)
- The "Schedule a Call" tab in `member-profile.html`'s request modal — Peer Connect-shaped
  scheduling (VC link, AI transcription), out of scope; see `docs/roadmap.md`'s Peer Connect
  section.
- Notifications (new request received, request completed/declined) — no notification
  infrastructure exists yet (`docs/master-tdd.md` Section 8.3).
- Frontend — the request modal, the member's received-requests inbox, and the requester's
  sent-requests page are not built. See `docs/user-stories.md`'s US-11.
- Resetting a decided (`completed`/`declined`) request back to `pending` — the admin dashboard
  prototype (`admin-dashboard.html`) has a "Reset" action; no product decision has been made on
  whether this should be allowed, so no endpoint exists for it.
- Deleting a consultation request — the admin dashboard prototype has a "Delete" action gated by a
  `deleteContent` permission; no endpoint exists for it, and no product decision has been made on
  retention/deletion policy for this resource.

## AI search

Backing `apps/backend/src/search/` (API) and `apps/backend/src/search-worker/` (background worker).
Schema: `docs/database-erd.md` → "AI search". Shared types: `packages/shared-types/search.ts`.
Natural-language questions over members, articles and events. The AI never writes SQL: a planner
turns the question into typed filters, the database does a hybrid (meaning + words + names) search,
and a judge re-scores the candidates and gives each a one-line reason. The short `answer` is then
composed **in code from the returned `results` only** (best matches + the top one's reason, plus
notes about relaxed filters) — it never names anything that isn't in `results`, and never refers to
the judge's internal candidate numbers. (Until 2026-10-20 the judge wrote the answer itself, which
could mention candidates that were filtered out afterwards.)

### 🔒 `POST /v1/search`

Signed in, any role. Responses are plain camelCase DTOs (no envelope), like every other route.

**Request** (`SearchRequestDto`) — a question:

| Field | Type | Notes |
|---|---|---|
| `query` | string, required | 2–500 characters after trimming (`400` otherwise) |
| `scope` | `'all'`\|`'members'`\|`'articles'`\|`'events'`, optional | default `all`; anything else is `400` |
| `limit` | integer 1–20, optional | otherwise the number in the question, else 10 |

**Response `200`** (`SearchResponse`): `{ logId, answer, results, applied, degraded, ms }`.

- `results[]` is a union discriminated by `type`: `MemberSearchResult` (`name`, `slug`, `headline`,
  `firm`, `location`, `services`, `available`, `rate: { minCents, maxCents, currency } | null`),
  `ArticleSearchResult` (`title`, `slug`, `excerpt`, `countries`, `publishedAt`, `readTimeMinutes`),
  `EventSearchResult` (`title`, `slug`, `summary`, `startsAt`, `endsAt`, `location`, `format`,
  `isFree`, `registrationUrl`). When a topic was searched each also carries `relevance` (0–10),
  `match` (`{ score, label: 'strong'|'good'|'possible', tier: 'best'|'related' }`) and `reason`
  (the judge's one-line explanation of why it fits — additive 2026-10-20, optional). Public display
  fields only.
- `applied` — the filters actually used (`types`, `topic`, `countries`, `city`, `serviceIds`,
  `dateFrom`, `dateTo`, `maxHourlyRateUsd`, `relaxed`). `relaxed` lists soft filters dropped
  because nothing matched, in order: practice area → city → country.
- `degraded` — stages that fell back, in `'planner'`\|`'embedding'`\|`'judge'`. Results are still
  returned (planner down → plain keyword search; embedding down → keyword only; judge down →
  unscored top results with a generic answer).
- `logId` — id of the `search_query_log` row for this question (`null` if logging failed).

**Privacy:** member contact details (email, phone, LinkedIn) never reach OpenAI or the client. Card
text is redacted before it is stored/embedded, and the answer and results are scrubbed again on
the way out.

**Feedback** — same route, `action: 'feedback'`:

```json
{ "action": "feedback", "logId": "<logId from an answer>", "rating": 1, "note": "optional, max 500" }
```

`rating` is `1` or `-1`. Response `200`: `{ ok: true }`. The update is scoped to the caller's own
`search_query_log` row; rating someone else's `logId` is accepted but changes nothing.

**Errors:** `400` (validation, query length, missing `logId`/`rating` for feedback), `401` (not
signed in), `429`.

**Rate limits** — `429` with body `{ statusCode: 429, code: 'RATE_LIMITED', message, retryAfterSeconds: 30 }`:

- questions: **10 per minute and 100 per hour** per user;
- `action: 'feedback'`: its own, looser **30 per minute** (separate counter).

Counts are kept in memory, so they are **per API instance** (a second API instance has its own
counters). Keyed by user id.

**Latency:** several seconds is normal — it is two sequential AI calls plus the database. Measured
on dev (5 sequential questions, 40 documents): median ≈ 7.4 s, worst ≈ 15.5 s end-to-end; planner
≈ 1.6 s, judge ≈ 3.1 s, hybrid search + hydration ≈ 2.2 s, embedding ≈ 0.5 s (cached topics: 0).
The first call after a cold start is the slowest.

**Worker:** cards are rebuilt and embedded by a separate process (`pnpm worker`, one container,
no HTTP port): an embedder loop (~1 min) and an outbox loop (~15 s). Search works without the worker for already-indexed content,
but new/changed members, articles and events only appear once it has run.

**Old → new names** (the contract this replaces was the `ai-search` Supabase Edge Function; nothing
consumed it yet, so there is no compatibility shim):

| Old (Edge Function) | New |
|---|---|
| `log_id` (request and response) | `logId` |
| `retry_after_seconds` | `retryAfterSeconds` |
| result `rate.min_cents` / `max_cents` | `rate.minCents` / `maxCents` |
| article `published_at`, `read_time_minutes` | `publishedAt`, `readTimeMinutes` |
| event `starts_at`, `ends_at`, `is_free`, `registration_url` | `startsAt`, `endsAt`, `isFree`, `registrationUrl` |
| `applied.service_ids`, `date_from`, `date_to`, `max_hourly_rate_usd` | `applied.serviceIds`, `dateFrom`, `dateTo`, `maxHourlyRateUsd` |
| error body `{ error }` only | `{ statusCode, code, message }` (+ `retryAfterSeconds` on 429) — see "Errors" |
| `search_query_log.applied` (stored snake_case) | stored camelCase from now on; older rows keep the old keys |

Operational command (in `apps/backend`): `pnpm worker` (the background worker, locally).

## Account

### 🔑 `GET /v1/me/contact`

The caller's own `phoneCountryCode`/`phone` (`profiles.phone_country_code`/`profiles.phone`).
Added for the consultation request form's phone-number prefill — the frontend's normal fast-path
session read (`getSessionUser()`) only sees the Supabase JWT's claims (name, email, role), which
don't carry phone, so this is the one real database read needed to get it. Both fields are `null`
when the caller never set a phone number (the common case for OAuth signups) — this is not a 404,
a signed-in caller always gets a `200` with possibly-null fields.

**Response `200`:** `{ phoneCountryCode: string | null; phone: string | null }`.

## Perks & Learnings (US-14, backend implemented 2026-10-29)

Source contracts: `packages/shared-types/resource.ts`; validation:
`apps/backend/src/resources/dto/`. References are the teammate's
standalone Perks/Learnings HTML files, plus the seeded schema. The original reference files
were removed after frontend implementation at the user's request; see `docs/design-system.md`
for the durable UI mapping.
User progress/saves/notes/completion tracking are out of scope. Templates were added 2026-10-30 — see
"Templates" below.

### Public browse and role-shaped detail

| Method | Route | Result |
|---|---|---|
| GET | `/v1/perks` | `PerkDto[]` |
| GET | `/v1/perks/:slug` | `PerkDto` |
| GET | `/v1/learnings` | `LearningDto[]` |
| GET | `/v1/learnings/:id` | `LearningDto` |
| GET | `/v1/collections` | `CollectionDto[]` with ordered, role-shaped items |
| GET | `/v1/collections/:id` | `CollectionDto` |

Metadata is public. Send `Authorization: Bearer <access_token>` to get authorized content.
An absent token means guest; a supplied malformed/expired/forged token returns **401**, never
an unverified role. Responses send `Cache-Control: private, no-store` and `Vary: Authorization`.
Inactive resources/collections are omitted; inactive or unknown detail returns **404**.
UUID parameters are validated (**400**). Lists return complete ordered arrays (sortOrder then ID),
without pagination. Optional list filters: `q` (case-insensitive name/title + description/summary),
`category`, `audience=tax|legal|audit`, `level=beginner|intermediate|advanced`,
`featured=true|false`, `kind=learning_playlist|perk_stack`. Use only filters relevant to the
resource; collections have kind/audiences, perks category/featured, and learnings category/audiences/
level/featured. Invalid enum filters and unknown query fields return **400**.

| Viewer | Perk offers | Learning playback URL |
|---|---|---|
| Guest | No codes, offer text, redemption links, terms or expiry | Never returned, including `access=open` |
| Signed-in client | Only `user_*` tier, if live, unexpired and redeemable | `open`, or `auto` when first in any active playlist |
| Member | `member_*` tier; falls back to the `user_*` tier when `member_offer` is empty. Live, unexpired and redeemable only | Every active video |
| Admin on public routes | Same as member | Every active video |

A member never sees less than a client: with no `member_offer`, a member gets the `user_*` tier (added 2026-10-30). A client never gets the `member_*` tier. `coming_soon` and expired offers
are withheld for every public viewer, including admin. Expiry is inclusive through its UTC date.
Public perk fields use a single `offer`, `couponCode`, `offerUrl`, `offerTerms`, `offerExpiresAt`,
`canRedeem`, and `lockReason` (`sign_in`, `membership`, `coming_soon`, `expired`, `unavailable`,
or null); raw tier-specific columns are never exposed. A product's ordinary `websiteUrl` is public.

Learning metadata includes `videoProvider`, `canWatch`, `lockReason` (`sign_in`, `membership`,
or null), and `videoUrl` (null when locked). The first-video rule uses the first **stored** ID
of each active playlist, before search/filtering. An explicitly `members` video stays locked for
clients even at position zero; `open` overrides playlist position. An inactive first video does
not promote the second video. A video can be open through any active playlist, regardless of
which collection is being viewed. Reordering/deactivating/deleting a playlist takes effect on the
next request. Exactly five seed videos are client-accessible.

Public collections hide inactive children, preserve the remaining order, and return matching
`itemIds` and `items`. Nested items use the same shaping as detail/list routes. Resource asset
paths are expanded to the public `resource-assets` bucket URL. Playback protection is API link
withholding, not DRM: externally hosted/public media can be accessed by anyone who already knows
its URL.

### Admin CRUD — fresh role + `manageResources`

For each resource `{perks|learnings|collections}`:

| Method | Route | Body / result |
|---|---|---|
| GET | `/v1/admin/{resource}` | All rows, including inactive; `Admin*Dto[]` |
| GET | `/v1/admin/{resource}/:id` | Full `Admin*Dto` |
| POST | `/v1/admin/{resource}` | `Create*Request`; **201** `Admin*Dto` |
| PATCH | `/v1/admin/{resource}/:id` | Non-empty `Update*Request`; **200** `Admin*Dto` |
| DELETE | `/v1/admin/{resource}/:id` | **204**, **404** if absent |

No token: **401**. Clients/members or admins without `manageResources`: **403**. Existing global
RolesGuard and AdminPermissionGuard re-check the active admin profile and permission in the DB.
Admin DTOs expose both perk tiers and playback URLs for content management. Slugs are generated
server-side from perk name / collection title; edits preserve them. Supplying `slug`, IDs,
timestamps, or unknown fields is rejected. Slug uniqueness conflicts return **409**.

Required create fields:

- Perk: `name`, `category`, HTTPS `websiteUrl`. Default `offerStatus=coming_soon`.
- Learning: `title`, HTTPS `videoUrl`, positive integer `durationMinutes`, `category`, `level`.
  Defaults: `videoProvider=youtube`, `access=auto`. YouTube URLs require a valid 11-character video
  ID on youtube.com/youtu.be/youtube-nocookie.com. `file` allows HTTPS hosted video URLs.
- Collection: `kind`, `title`. Default empty `itemIds` and `audiences`. `kind` is immutable.

All resources support `isActive` (default true), non-negative `sortOrder` (default 0). Perks and
learnings also support `isFeatured` (default false). Optional strings/arrays and nullable fields
are listed in the shared contract. PATCH omission preserves a field; null clears only nullable
fields. Required/non-nullable fields reject null; empty patches reject with **400**.

For a live perk at least one tier must have offer text and a nonblank code or HTTPS redemption
URL. Offer text without redemption details, or redemption details without offer text, is **400**.
`coming_soon` may retain staged offers internally but none are disclosed publicly. To remove a
tier, clear its offer, code and link together. Dates are ISO `YYYY-MM-DD`.

**Playlist/stack membership and reorder:** PATCH `itemIds` with the complete desired ordered UUID
array. Add by including another ID; remove by omitting it; reorder by permuting it. Duplicate,
unknown, or wrong-kind IDs reject the entire write (**400**). Up to 100 IDs; every reference is
validated against the appropriate table. Inactive items may be staged but remain absent in
public collections. Concurrent full-array edits are last-write-wins. Deleting a perk/video prunes
its ID from all collections via the existing database trigger in the same deletion transaction.

Thumbnails must be our resource-assets copies, never YouTube thumbnail URLs (which reveal the
locked video ID). Accept bucket-relative `learnings/...` paths or HTTPS URLs in our resource-assets
bucket. Asset content must not embed confidential codes/playback links. No upload endpoint is
added here; use the existing re-runnable resource upload script / provisioned assets.

### Templates (added 2026-10-30)

Downloadable starter documents (Word / Excel / PowerPoint / PDF). **Every template is
members-only.** Files live in the private `template-files` Storage bucket; the stored object path
is never returned by a public route — a member gets a 60-second signed link instead.

| Method | Route | Auth | Result |
|---|---|---|---|
| GET | `/v1/templates` | 🌐 optional bearer | `TemplateDto[]` (active only). Query: `q`, `category`, `audience`, `featured` |
| GET | `/v1/templates/:id` | 🌐 optional bearer | `TemplateDto` |
| POST | `/v1/templates/:id/download` | 🔒 member | `TemplateDownloadDto` `{ url, fileName, expiresAt }` |
| GET | `/v1/collections?kind=template_kit` | 🌐 optional bearer | Kits with `items: TemplateDto[]` |

`TemplateDto`: `id, slug, title, description, category, highlights[], fileType, fileName,
fileSizeBytes, previewImageUrl, audiences, isFeatured, sortOrder, canDownload, lockReason`.
`previewImageUrl` (added 2026-10-30) is a public teaser image of the first page/sheet/slide — a
`templates/...` path in the public resource-assets bucket (returned as a full URL) or an HTTPS URL;
`null` means the UI shows a designed cover (`sign_in` for guests,
`membership` for clients, `null` for members/admins). No path or URL field.

**Download** — guest **401**, client **403** (JWT role). Because a JWT role can lag a membership
change by up to the token lifetime, the service then re-reads `profiles` and requires an active
`member`/`admin` (**403** otherwise). Unknown or inactive id **404**. The signed URL is valid for
60 seconds, for that one object only, and carries `Content-Disposition: attachment` with the
template's `fileName`.

**Admin** (🛡️ `manageResources`, same fresh-admin guard as the rest of this module):

| Method | Route | Notes |
|---|---|---|
| GET | `/v1/admin/templates` / `/:id` | `AdminTemplateDto` incl. `filePath` and `isActive` |
| POST | `/v1/admin/templates/upload` | Multipart field `file`, ≤15MB. Type sniffed from the bytes (`file-type`): docx/xlsx/pptx/pdf only, else **400**. Stored at `uploads/<uuid>.<ext>`; returns `TemplateUploadDto` `{ filePath, fileName, fileSizeBytes, fileType }` — the file name is the uploader's, stripped of any path and given the true extension |
| POST | `/v1/admin/templates` | `CreateTemplateRequest` = metadata + the upload response. `filePath` must match `^(starter\|uploads)/[a-z0-9-]+\.(docx\|xlsx\|pptx\|pdf)$`, end in `fileType`, and exist in the bucket, else **400**. Slug generated server-side |
| PATCH | `/v1/admin/templates/:id` | Partial. Swapping `filePath` deletes the old `uploads/` object once nothing references it |
| DELETE | `/v1/admin/templates/:id` | **204**. Pruned from every kit (DB trigger); its `uploads/` file is deleted. Seed `starter/` files are kept |

Kits use the existing collection routes with `kind: 'template_kit'`; `itemIds` must be template ids.

### Verification

There are no automated tests for this module (the one-off dev scripts were removed 2026-10-30).
Verify a change by calling the API as each role with the Postman collection: a guest (no token),
a client, a member and an admin. Confirm codes, offer links, playback URLs and template file
paths never reach a role that shouldn't see them, and that admin routes return **403** to
non-admins.
