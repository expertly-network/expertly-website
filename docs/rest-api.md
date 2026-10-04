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
`documents[]`, and (added 2026-09-27, also surfaced on the admin detail endpoint above)
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

Pure fetch-and-normalize — does **not** write to the draft. Fetches whatever profile data the
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

### 🔒 `POST /v1/applications/me/photo/linkedin`

Added 2026-09-26. Best-effort: pulls the `picture` claim off the caller's linked LinkedIn OAuth
identity (via the Supabase Admin API — `auth.identities`, not a public-schema table) and stores it
through the exact same path as a manual photo upload below. Never overwrites a photo the applicant
already has; the frontend only calls this when `photoUrl` is still unset. No request body.

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
(`photo`: JPEG/PNG, 5MB max; `document`: JPEG/PNG/PDF, 15MB max) before being written to the
public `application-assets` Storage bucket at a deterministic path — for `photo`, always
`members/application/{applicantId}/profile-photo` (**no extension**, fixed 2026-09-26: the path
used to bake in the sniffed extension, so re-uploading in a different format, e.g. jpg → png,
produced a second orphaned object instead of replacing the first; the upload call is `upsert:
true`, so a stable key is what actually makes re-upload behave like a replace) or, for `document`,
`document-{n}.<ext>`, appended. Only allowed while the caller has a `draft` application.

**Response `200`:** `ApplicationDto` — the updated record, `photoUrl`/`documents[].url` a plain
public URL built from the stored path (no signing). **Errors:** `400` no draft to attach to,
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
and never regenerated on `PATCH`. Routes below still key on the real `id` (UUID), matching this
session's article detail route (`/articles/[id]`); `slug` is carried on the DTO for a future
pretty-URL pass, not wired into routing yet.

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
an already-published article. Seed data (`supabase/migrations/0007_dev_seed_articles.sql`) still
pre-populates it for dev fixtures so the callout has something to show without waiting on a real
model call. Additive, no version bump.

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

**Response `201`:** `AiDraftArticleResponse` — carries `sources` (URLs the model actually
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
first.

### 🛡️ `manageArticles` `PATCH /v1/admin/articles/:id`

Approve (→ `published`) or reject (→ `rejected` + `rejectionReason`) an article that's currently
`pending_review`. Same guard chain as the `GET` above.

**Request:** `AdminArticleReviewRequest` — `status: 'published' | 'rejected'`, `rejectionReason`
required when rejecting.

**Response `200`:** `ArticleDto`. **Errors:** `401` · `403` not admin or lacks `manageArticles` ·
`400` article isn't `pending_review`, or rejecting without a reason.

## Articles — not built yet (explicitly deferred)

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

**Query params:** `q` (search across name/practice/location/firm/title), `serviceId` (repeatable),
`categoryId` (single — broadens to "any service in this category"; combined with `serviceId`, both
must match), `country` (repeatable), `rateMinCents`/`rateMaxCents`, `sort`
(`featured`\|`tenure`\|`rate_asc`\|`rate_desc`, default `featured`), `page`/`pageSize` (default
`pageSize=8`, matching the prototype's infinite-scroll page size).

**Response `200`:** `MemberListItemDto[]` — id, slug (added 2026-09-27; server-generated, unique,
permanent — the key for `GET /v1/members/:slug` and the frontend's `/members/[slug]` route), name, initials, headline, bio, firmName,
region, country, city, services (`{id, name, categoryId, categoryName}[]`, from `member_services`),
isVerified, memberTier, yearsOfExperience, rateMinCents, rateMaxCents, rateCurrency, photoUrl.
Tenure/rate display strings
(`"18y"`, `"$420/hr"`) are **not** returned — format them client-side from the numeric fields.
`bio` is the full field (not pre-truncated) — the directory card excerpt is a client-side
`line-clamp-2`, matching the design's own approach, so no separate excerpt field was added.

### 🔒 `GET /v1/members/:slug`

**Keyed on the member's slug, not the UUID** (e.g. `/v1/members/priya-menon`) — changed in place on
`/v1` on 2026-09-27 as a deliberate exception to the "breaking changes go to `/v2`" rule: the
frontend was the only caller, both ship together, and the feature wasn't live yet. A UUID passed
here is treated as a (non-matching) slug and returns `404`. Every other member route below — the
owner-only `/:id/uploads` and `/:id/edits`, and admin `PATCH /v1/admin/members/:id` — stays keyed on
the UUID (`MemberDto.id`): those compare it directly against the caller's JWT, never appear in the
browser's address bar, and the UUID remains the key every other table references.

Full profile — all `member_profiles` columns, all 8 child arrays, `memberServices`. **Requires
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

**Request:** `{ fileName: string, contentType: string }`. **Response `201`:** `{ uploadUrl: string,
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

**Request:** `CreateMemberEditRequest` — `{ section, payload, proofFileUrl?, proofLink? }`. Shape of
`payload` depends on `section` (see `packages/shared-types/member.ts` for the per-section
discriminated union) and matches the section's actual base-data shape — **not** the prototype's
flattened single-string-per-item shortcut (see `docs/database-erd.md`).

Proof shape also depends on `section`: `education`/`work_experiences` use the top-level
`proofFileUrl`/`proofLink` (one shared proof for the whole batch); `engagements`/`testimonials`/
`awards` instead carry proof **per item**, as `payload[i].proofAttachments?:
{type: 'file'|'link', url, label}[]` — a member can attach any mix of multiple files and links to
a single item, not just one or the other. The DTO only validates `payload` is present (its exact
shape is section-dependent, so class-validator can't express it) — `MembersService
.validateEditPayloadShape()` does the real per-section check, including that every
`proofAttachments` entry (when present) has a valid `type`/`url`/`label`. `proofAttachments` is
moderation-only evidence: on admin approval it is stripped before the item is written into the
live `member_profiles` column, so it's never exposed on the public `GET /v1/members/:slug` response.

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

Approve or reject one edit request. `{ status: 'verified' | 'rejected', reviewNote?: string }` —
**`reviewNote` is required (non-blank) when rejecting** (added 2026-09-27): it's shown to the
member on their own profile as the reason. On `verified`: for the array-shaped sections, replaces
that member's items for the section wholesale with `payload`'s items (`proofAttachments` stripped);
for `headline_bio`/`contact`, overwrites the corresponding `member_profiles` columns directly.
Sets `reviewedBy`/`reviewedAt` to the caller/now either way.

**Key-client logos are published on approval.** A newly uploaded logo sits in the private
`member-proofs` bucket as the item's `logoUploadPath`; the public profile reads `logoUrl`. On
approval the file is magic-byte checked (PNG/JPEG/WebP/GIF, ≤ 2MB), copied to the public
`application-assets` bucket at `members/<memberId>/client-logos/<uuid>.<ext>`, and `logoUrl` is set
to its public URL; `logoUploadPath` is dropped. Items without a new upload keep their existing
`logoUrl`. (Before this, approved logos were silently lost — written as `logoUploadPath`, which
nothing reads.) A logo that fails the check makes the whole approval `400` with a message naming
the client — reject the edit with a reason instead.

**Response `200`:** `MemberProfileEditDto`. **Errors:** `400` rejecting without a `reviewNote`, or
an invalid key-client logo · `409` if the edit is no longer `pending` (already reviewed, or
replaced by a newer submission).

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
**Errors:** `401` no/invalid token · `400` validation failure (including `message` under 100
characters, neither `serviceId` nor `customServiceLabel` provided, or a `serviceId` the target
member doesn't offer), `memberId` isn't a `member`-role profile, that member is
deactivated/suspended, or `memberId === caller.id` · `409` caller already has a pending request to
this member (body includes `retryAfter`, the ISO timestamp the cooldown ends) · `429` rate limit
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

Owner (the target member) transitions `pending` → `completed`/`declined`. No intermediate state,
no cancel, no re-opening a decided request. `responseMessage` is required (10–500 chars) on every
transition — the requester sees it on their own `/mine` list, so a bare status flip with no
explanation isn't enough context for them.

**Request:** `UpdateConsultationStatusRequest`. **Response `200`:** `ConsultationRequestDto`.
**Errors:** `401` · `403` caller isn't the request's `memberId` · `404` not found · `409` already
decided · `400` `responseMessage` missing or under 10 characters.

### 🔒 `GET /v1/consultations/:id/messages`

Either participant (the requester or the target member on this request) can read the thread,
regardless of `status` — history stays visible after a decision, only posting new messages closes.
Newest-last (chat order).

**Response `200`:** `ConsultationMessageDto[]`. **Errors:** `401` · `403` caller is neither the
request's `requesterId` nor `memberId` · `404` request not found.

### 🔒 `POST /v1/consultations/:id/messages`

Either participant posts a message — only while `status` is `'pending'`. Once the member decides
(`completed`/`declined`), the conversation closes to new messages on both sides; the requester
rates it instead (see `PATCH /v1/consultations/:id/rating` below).

**Request:** `CreateConsultationMessageRequest` (`body`, 1–2000 chars). **Response `201`:**
`ConsultationMessageDto`. **Errors:** `401` · `403` · `404` · `409` request already decided ·
`400` `body` missing or over 2000 characters.

### 🔒 `PATCH /v1/consultations/:id/rating`

The requester rates the conversation 1–5, once the member has decided (`status` is no longer
`'pending'`) — this is what replaces the now-closed message composer on the requester's side.

**Request:** `RateConsultationRequestRequest` (`rating`, integer 1–5). **Response `200`:**
`ConsultationRequestDto`. **Errors:** `401` · `403` caller isn't the request's `requesterId` ·
`404` not found · `409` request is still `pending` · `400` `rating` not an integer 1–5.

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

## Account

### 🔑 `GET /v1/me/contact`

The caller's own `phoneCountryCode`/`phone` (`profiles.phone_country_code`/`profiles.phone`).
Added for the consultation request form's phone-number prefill — the frontend's normal fast-path
session read (`getSessionUser()`) only sees the Supabase JWT's claims (name, email, role), which
don't carry phone, so this is the one real database read needed to get it. Both fields are `null`
when the caller never set a phone number (the common case for OAuth signups) — this is not a 404,
a signed-in caller always gets a `200` with possibly-null fields.

**Response `200`:** `{ phoneCountryCode: string | null; phone: string | null }`.
