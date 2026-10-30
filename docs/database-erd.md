# GrowXQ — Database ERD

Derived per-feature from `design/static_html/`, per `CLAUDE.md`'s "fixed contract, derived once"
convention — not a speculative upfront spec. Grows as each feature's backend session lands.

## Identity & Auth

See `supabase/migrations/0001_extensions.sql`–`0004_tables.sql` and [`docs/auth.md`](auth.md) — `profiles`
table, `role` enum (`client`/`member`/`admin`), Supabase Auth integration.

`handle_new_user()` (`0003_functions.sql`) is an `after insert on auth.users` trigger — every
signup, whichever role it eventually becomes, gets a matching `profiles` row in the same
transaction as the `auth.users` insert. It reads both our own `signUp()` metadata keys
(`first_name`/`last_name`) and the OIDC standard claim names LinkedIn's/Google's integration
actually populate (`given_name`/`family_name`), so every signup path populates real names instead
of silently leaving OAuth signups blank. It fills:

- `role`, `status` — left at their column defaults (`'client'`, `'active'`). Every signup starts
  as `client` regardless of path; `role` only ever becomes `'member'` via a separately, manually
  approved `membership_applications` row (see below) — never self-service, never set here.
- `email`, `first_name`, `last_name` — from Supabase Auth's own signup metadata, as above.
- `auth_provider` — read from Supabase's `raw_app_meta_data->>'provider'`, matched against the
  known enum values via a `case` (not a raw `::auth_provider` cast) so an unrecognized value from
  Supabase can never raise an invalid-enum exception and roll back the signup — falls back to
  `'email'`.
- `last_login_at` — set to signup time. There's no separate login-event tracking built yet, so
  this is the first truthful value for it.
- `consent` — a hardcoded `{"termsVersion": "1.0", "privacyVersion": "1.0", "acceptedAt": ...}`
  snapshot, same pattern as `membership_applications.terms_version_agreed`/
  `privacy_version_agreed` — there's no real consent-versioning system yet, so `"1.0"`/`"1.0"` is
  the confirmed current value, not a placeholder. Revisit this function the day those documents
  change or a real versioning scheme is built.

Since 2026-10-30 it runs with `search_path = ''` (every name schema-qualified) and **raises**
instead of skipping: an auth user with no/blank email (`not_null_violation` — only phone or
anonymous sign-in could produce one, neither enabled) or an email already on another profile
(`unique_violation` on `profiles_email_key`; GoTrue normally links same-email identities to the
existing user, so this only happens if that linking was skipped). The raise aborts the GoTrue signup
("Database error saving new user"); the message shows in the Auth logs.

### Conventions (2026-10-30 audit follow-ups — `0004_tables.sql`)

- **RLS:** every policy comparing against the caller is scoped `to authenticated` and wraps
  `(select auth.uid())`, so Postgres evaluates it once per statement (an initPlan) rather than per
  row. RLS stays defense-in-depth — the API uses the service role.
- **CHECK constraints added:** `ai_draft_generations.status in ('success','failed')`,
  `articles.creation_mode in ('manual','ai')`, `membership_applications.list_price_cents >= 0` and
  `discount_amount_cents >= 0`, `member_profiles.rate_currency ~ '^[A-Z]{3}$'` (ISO 4217).
- **`updated_at` triggers** (`set_updated_at()`) now also on `categories` and `services`.
- **Indexes added:** `member_profile_edits_pending_idx (member_id, section) where status =
  'pending'` (superseding older pending edits on submit); `member_profiles_text_trgm_idx` (one GIN
  trigram index over `headline, firm_name, bio, city, state, country` — the directory's free-text
  `ILIKE '%…%'`, read as one BitmapOr); `profiles_full_name_trgm_idx` (GIN trigram on the
  expression `lower(coalesce(first_name,'') || ' ' || coalesce(last_name,''))` — must stay
  character-for-character identical to `member_directory_ids()`' name match or it isn't used).
  Every FK column the API filters or joins on has its own index (e.g. `*_reviewed_by_idx`,
  `consultation_requests_service_id_idx`, `consultation_messages_request_id_idx (request_id,
  created_at)`, `articles_ai_generation_id_idx`).
- **Indexes dropped:** `perks_active_category_idx` (the API reads the whole tens-of-rows table and
  filters in code) and `learnings_search_idx` (no query reads `learnings.search_tsv` yet — the
  column is kept for the planned library search; add the GIN index with it).
- **Storage:** the public `resource-assets` bucket no longer allows `image/svg+xml` (an SVG can
  carry script). The one existing SVG (`perks/logos/cleartax.svg`, from `0008`) predates this.

## Membership applications (`supabase/migrations/0001_extensions.sql`–`0004_tables.sql`)

**Source:** `design/static_html/apply.html` and `onboarding_form.html` (two UI iterations of the
identical 5-step wizard — LinkedIn Import → Identity → Background → Services & Rates → Review &
Submit — same fields in both, so they don't fork this schema) plus `review.html` (post-submit
status page, no additional data).

**Flow (updated — see `docs/superpowers/specs/2026-08-23-member-application-form-design.md` for
the full design):** a signed-in `client`'s application starts as a `draft` row the moment they
save their first field, mutated in place across `POST /v1/applications/me` calls as they move
through the wizard (real save-and-resume, not frontend-only state), then transitions to
`submitted` once the merged row is complete. From `submitted` onward the row is treated as an
immutable snapshot again, same as the original design. Approving an application
(`PATCH /v1/admin/applications/:id`, backend-only, no UI) is the only path that creates a
`member_profiles` row and flips `profiles.role` to `member`.

### `membership_applications`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `applicant_id` | uuid FK → `profiles.id` | |
| `status` | enum `draft`\|`submitted`\|`under_review`\|`approved`\|`rejected` | default `draft` |
| `current_step` | smallint, default `1` | which wizard step to resume on; only meaningful while `status = 'draft'` |
| `photo_path` | text, nullable | Storage path within the `application-assets` bucket. That bucket is **public**, so this resolves to a plain, permanent URL at read time (`ApplicationsRepository.getPublicUrl()`) — never a signed URL. |
| `first_name`, `last_name` | text, nullable | nullable so a draft can be incomplete; required by the time `status` becomes `submitted` (enforced in `ApplicationsService`, not the DB) |
| `contact_email` | citext, nullable | deliberately separate from `profiles.email` (work vs. login email) |
| `phone_country_code`, `phone` | text | optional, always |
| `region` | enum (7 values: `asia_pacific`…`africa`), nullable | **not client-settable** (2026-09-26) — derived server-side from `country` via a fixed map (`apps/backend/src/applications/constants/country-region.ts`); required at submit except when `country = 'Other'`, which has no defensible region and stays `null` |
| `country` | text, nullable | free text in the design (fixed option list + "Other"), not its own lookup table yet; required at submit |
| `state`, `city` | text | optional, always |
| `linkedin_url` | text, nullable | required at submit |
| `bio` | varchar(2000), nullable | raised from varchar(500) 2026-09-26 — the old limit silently truncated a normal-length bio mid-sentence; required at submit |
| `years_of_experience` | smallint, check 0–60, nullable | required at submit |
| `work_experiences` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | see below — not a child table; non-empty required at submit |
| `educations` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | see below; non-empty required at submit |
| `peer_references` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | added 2026-08-31 per client feedback; see below — exactly 2 (not just non-empty) required at submit |
| `documents` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | array of `{id, filename, path, mimeType, sizeBytes, uploadedAt}` — `path` is within the **private** `application-documents` bucket (`<applicantId>/<id>.<ext>`), read back only as a short-lived signed URL; only the profile photo has upload UI in this iteration |
| `service_preferences` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | see below — not a join table; non-empty required at submit |
| `rate_min_cents`, `rate_max_cents` | int, nullable, check `max > min` (only enforced once both are non-null) | USD/hr; required at submit |
| `selected_tier` | enum `budding_entrepreneur`\|`seasoned_professional`, nullable | computed and stamped only at the submit transition — admin can override, but that override applies to the eventual `member_profiles` row, not this record |
| `billing_period` | enum `monthly`\|`annual`, nullable | required at submit; app-layer now only ever writes `'annual'` (monthly removed 2026-08-31 per client feedback) — the DB enum still has the unused `monthly` value, not worth an `ALTER TYPE ... DROP VALUE` migration for a value nothing writes |
| `list_price_cents` | int, nullable, check `>= 0` | stamped at the submit transition |
| `coupon_code` | text, nullable | free text; validity checked in application code, no `coupons` table (deliberate — see below) |
| `discount_amount_cents` | int, default 0, check `>= 0` | |
| `amount_due_cents` | int, nullable, check `>= 0` | stamped at the submit transition |
| `payment_status` | enum `pending`\|`waived`\|`paid`, nullable | stamped at the submit transition; only `waived` is reachable without a real payment gateway |
| `linkedin_import_consent` | bool, default `false` | |
| `terms_version_agreed`, `privacy_version_agreed` | text, nullable | e.g. `"1.0"`; required at submit |
| `background_check_consent` | bool, nullable | must be `true` at submit |
| `reviewed_by` | uuid FK → `profiles.id`, nullable | written by `PATCH /v1/admin/applications/:id` |
| `reviewed_at`, `rejection_reason` | nullable | ditto |
| `created_at`, `updated_at` | timestamptz | |

**`draft` is the one deliberate exception to the immutable-snapshot design below** — everything
said about `work_experiences`/`educations`/`service_preferences` being "written once, read as a
whole, never edited per-entry" describes the row from `submitted` onward. A `draft` row is
genuinely mutated in place, in full, across multiple calls; completeness for the `submitted`
transition is asserted in `ApplicationsService.assertComplete()`, not by any DB constraint — same
"cross-field rules live in the service" convention this schema already used for
`rate_max_cents > rate_min_cents`.

**`work_experiences` / `educations` — JSONB arrays, not child tables.** Initial design used two
normalized child tables (`application_work_experiences`, `application_educations`); reconsidered
after a fair challenge to that choice. This data is an immutable snapshot — written once at
submit, read as a whole for review, never queried or edited per-entry — so none of the reasons
that will justify normalizing the *member*-side equivalents (directory search by employer, admin
editing one entry — a separate, later feature) actually apply here. JSONB also matches the
frontend wizard's own array-of-objects shape exactly, no relational mapping needed. Trade-off:
individual sub-fields (e.g. `firmSize`) aren't DB-type-enforced, only validated at the DTO layer —
acceptable since this table is built from a single validated request, not written to incrementally
from multiple paths.

- `work_experiences` element shape: `{ title, company, city, firmSize, companyUrl, startMonth,
  startYear, endMonth, endYear, isCurrent }`
- `educations` element shape: `{ institution, degree, fieldOfStudy, startYear, endYear }`
- `peer_references` element shape: `{ name, relationship, email, phone }` (`phone` optional) —
  same JSONB trade-off, plus the same "cardinality rule lives in the service" convention:
  `assertComplete()` requires exactly 2 entries to submit, not just "at least 1" like
  `work_experiences`/`educations`.

**`service_preferences` is JSONB too**, not a join table — `[{ serviceId, priority, customLabel?
}, ...]`, up to 3 entries. This was reconsidered a second time: the original relational design had
a real justification (a genuine FK to the taxonomy table, guaranteeing every preference points at
a real, existing row) versus a weak one ("might want to query 'who wants M&A Tax' someday" —
speculative, nothing in the current build needs it, retracted). The FK-integrity argument was real,
but the decision was made to accept that trade-off for schema simplicity anyway.

**This is a load-bearing trade-off, not a shortcut to forget about**: with no FK, nothing at the
database level stops a `service_preferences` entry from referencing a `serviceId` that doesn't
exist (or no longer does — the referenced service is later renamed or deactivated). **Every write
path must validate each `serviceId` against a live query of `services` before insert/update** —
there is no CASCADE/RESTRICT safety net here the way there is elsewhere in this schema. `services`
itself is still a real table specifically so this validation (and the frontend's dropdown options)
has something to check against. `customLabel` is required when the referenced service `is_custom`.

### `categories` / `services`

Replaces the old flat `practice_areas` table (12 rows, 3-value `category` enum) outright — a
client-supplied, real two-level taxonomy (17 categories, 138 services), not a backfill. See
`docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md` for the full rationale and
seed data.

**`categories`**: `id`, `name` (unique), `sort_order`, `image_url` (nullable, decorative-only —
unlike the old `practice_areas` seed, no images are seeded for the 17 categories today; stays null
until an admin sets one via the taxonomy admin CRUD), `is_active`, `created_at`, `updated_at`.

**`services`**: `id`, `category_id` (FK → `categories.id`, no `ON DELETE` clause — deleting a
category with services fails with a `23503` FK violation, caught and turned into `409
CATEGORY_HAS_SERVICES`), `name`, `sort_order`, `is_custom` (true for the one "<<Custom Field>>"
placeholder row a category may have — only 6 of the 17 categories have one; selecting it reveals a
free-text input, stored as a `customLabel`/`customServiceLabels` sidecar on whichever table
references the id), `is_active`, `created_at`, `updated_at`. `unique(category_id, name)` — names
repeat across categories in the source list (e.g. "Startups & Emerging Companies"), so uniqueness
is scoped per-category, not global.

Both tables get a `select-all` RLS policy (`using (true)`), matching `practice_areas` before them —
admin writes go through the backend's service-role client, which bypasses RLS.

Not region-scoped (no `country`/`city` on either table) — a deliberate call, not a deferred one: a
service like "M&A Tax" means the same thing everywhere, so regional filtering belongs on the
*member's* own location (a `member_profiles` field), not on the taxonomy itself.

### Design decisions

- **No `coupons` table.** Deliberately kept as a free-text field checked against application-code
  logic, not a DB-backed lookup — simplest thing that works for "show a code, zero the amount," no
  admin UI exists to manage a real coupons table yet anyway. Revisit if/when coupons need to be
  admin-manageable.
- **`country` is free text**, matching the design's fixed-but-not-database-backed option list —
  not normalized into its own table for this feature; revisit if a future feature needs to query/
  filter by country as a first-class entity.
- **`application-assets` Storage bucket** — **public, images only** (`allowed_mime_types`
  JPEG/PNG/WebP/GIF, 5MB). Holds the applicant photo at
  `members/application/<applicantId>/profile-photo`, which resolves to a plain, permanent URL at read
  time; `member_profiles.photo_path` reuses the exact same path once an application is approved (same
  bucket, same file, nothing to move). Uploads are proxied through the backend
  (`POST /v1/applications/me/uploads`, unlike `member-proofs`' client-side signed-upload-URL flow) so
  magic-byte MIME validation is actually possible before the object is written.
- **`application-documents` Storage bucket** — **private** (added 2026-10-29). Vetting documents
  (`documents[]` — CVs, certificates, ID) live here at `<applicantId>/<documentId>.<ext>`, an
  unguessable key, and are only ever returned as 15-minute signed URLs to the applicant and to admins
  with `manageApplications`. They used to sit in the public bucket at `document-<n>.<ext>`, which made
  them downloadable by anyone who knew a member's id (public via `GET /v1/members`);
  `apps/backend/scripts/migrate-application-documents.mjs` moves any such legacy objects.
- **No `storage.objects` policies on any bucket** (2026-10-29). Only the service-role backend writes
  to Storage — directly, or by minting a one-time signed upload URL (`member-proofs`), neither of
  which needs a policy. The earlier owner-folder `for all` policies let any signed-in user write
  straight to Storage with the public anon key, skipping magic-byte checks and photo review.
- Migration verified end-to-end against a real (throwaway, local) Postgres instance before being
  considered final — three separate passes as the schema was revised (child tables → JSONB, then
  service preferences relational → JSONB): migrations apply cleanly in sequence each time, the
  `rate_max > rate_min` check constraint correctly rejects invalid data, and every
  `jsonb_typeof(...) = 'array'` check correctly rejects malformed (non-array) JSON on every JSONB
  column, including `service_preferences`.

## Articles (`supabase/migrations/0001_extensions.sql`–`0004_tables.sql`)

**Source:** `design/static_html/articles.html` (browse grid + write flow), `article.html` (detail
page), `admin-dashboard.html`'s article panels, and `assets/admin-data.js`/`article-engagement.js`
— read in full, not spot-checked, per this doc's own methodology.

**Flow:** a signed-in `member` (or `admin`) writes an article through one of two paths (write it
themselves, or answer the GrowXQ AI wizard's 3 steps) and submits it. What happens next is a
deliberate, reversed decision from this table's original note (see "Design decisions" below): an
`ARTICLES_REVIEW_MODE` env var (`instant` default | `editorial`) controls whether submitting
publishes immediately (`instant`, the original-and-still-default behavior) or sets `status` to
`pending_review` for an admin with the `manageArticles` permission to approve (→ `published`) or
reject (→ `rejected` + `rejection_reason`) via `GET`/`PATCH /v1/admin/articles`. Owner or admin can
also flip `status` back to `draft` (self-service unpublish) via `PATCH` regardless of mode.

### `articles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text NOT NULL, unique | **always server-generated** from `title` on `POST` (kebab-case, `-2`/`-3`/... suffix on collision) — never client-writable, never regenerated on `PATCH`, so it's a permanent URL key — the frontend detail route is `/articles/[slug]`, backed by `GET /v1/articles/:idOrSlug` |
| `author_id` | uuid FK → `profiles.id` | |
| `status` | enum `draft`\|`pending_review`\|`published`\|`rejected` | default `draft`; which of `published`/`pending_review` a submission resolves to is decided server-side by `ARTICLES_REVIEW_MODE`, never client-chosen directly (see "Flow" above) |
| `title` | text | |
| `body` | text | full article content, rich HTML produced by the write flow's Tiptap editor (`apps/frontend/components/articles/RichTextEditor.tsx`) — `<p>`/`<h2>`/`<h3>`/`<ul>`/`<ol>`/`<li>`/`<blockquote>`/`<strong>`/`<em>`/`<u>`/`<code>`/`<pre>`/`<a>`/`<br>` only, always passed through `sanitize-html` server-side before insert/update, per root `CLAUDE.md`'s non-negotiable rule — kept in lockstep with the editor's own toolbar (no image/table support in either) |
| `excerpt` | text | **always server-derived** from `body` (truncated to ~200 chars on a word boundary) — never accepted from the client |
| `read_time_minutes` | smallint | **always server-derived** from `body`'s word count (`words / 200`, min 1) |
| `cover_image_url` | text | write-it-yourself: member-picked from a curated static set (`apps/frontend/lib/cover-images.ts`, keyed by category, no AI/upload); AI wizard: same set, pre-selected |
| `service_ids` | uuid[], default `{}` | see below — not a join table, same trade-off as `service_preferences` |
| `custom_service_labels` | jsonb NOT NULL, default `{}` | `{ [serviceId]: label }` — only populated for ids in `service_ids` that are `is_custom` services |
| `countries` | text[] NOT NULL, default `{}` | genuinely multi-select (an article can apply to more than one country) — same array/no-FK trade-off as `service_ids`, except free-form country names rather than ids, so no live-validation query on write. Was a single required `country` string before the write-flow rebuild; migrated in place (pre-production, no rows to backfill carefully) |
| `state` | text | optional |
| `rejection_reason` | text | nullable; set only when `status = 'rejected'` (editorial mode), cleared on any resubmission — same shape as `membership_applications.rejection_reason` |
| `ai_summary` | text | nullable; server-written once by `ArticlesService.generateSummaryIfNeeded()` the first time an article becomes `published` (fire-and-forget, never blocks the publish/approve response) — see `docs/rest-api.md`. Never client-writable. Seed data pre-populates it for dev fixtures. |
| `creation_mode` | text NOT NULL, check `manual`\|`ai` | default `'manual'`; `'manual' \| 'ai'`, settable via `CreateArticleRequest.creationMode` — see `POST /v1/articles/ai-draft` in `docs/rest-api.md` |
| `ai_generation_id` | uuid FK → `ai_draft_generations.id`, `on delete set null` | nullable; set only on `POST /v1/articles` from `CreateArticleRequest.aiGenerationId` (the ai-draft response's `generationId`), after checking the generation belongs to the caller — links an AI-written article back to the inputs/output it was generated from, for the admin AI-generations log. Never changed by `PATCH`. Forces `creation_mode = 'ai'`. FK constraint is added after `ai_draft_generations` is created in `0004_tables.sql` (that table is declared later in the file). Indexed. |
| `created_at`, `updated_at` | timestamptz | |

**`service_ids` is a native array, not a join table** — the write form's service picker is
genuinely multi-select against the same taxonomy already in `services` (the browse grid's single
`category` string was a *display* convenience in the old prototype's flat model, joining multiple
selections with commas — not the real relationship, so the real schema doesn't reproduce it). Same
load-bearing trade-off as `membership_applications.service_preferences`: no FK (arrays can't
reference a table), so **every write path must validate each id against a live,
`is_active`-filtered `services` query before insert/update** — there is no CASCADE/RESTRICT safety
net. Unlike the write path, *reading* an article's services back deliberately does **not** filter
by `is_active` — an already-published article should keep showing the real name of a service even
if it's since been deactivated.

### `member_recommendations` (2026-10-10)

A peer recommendation one active member writes for another (Reviews & Recognition tab). Published
immediately, no moderation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `author_id` | uuid FK → `member_profiles.profile_id`, cascade | |
| `recipient_id` | uuid FK → `member_profiles.profile_id`, cascade | |
| `body` | text, check length 10–2000 | plain text |
| `is_hidden` | bool, default `false` | toggled only by the recipient |
| `hidden_at` | timestamptz, nullable | |
| `created_at`, `updated_at` | timestamptz | |

Constraints: `author_id <> recipient_id`; unique `(author_id, recipient_id)` (one recommendation per
pair). RLS: visible rows public, hidden rows to the recipient only (defense-in-depth; the backend
enforces access).

### Design decisions — divergences from the static prototype

These are deliberate product decisions made explicitly with the person who commissioned this
feature, not derived from (and in one case directly contradicting) what the static HTML shows:

- **Reading a single article's full body requires being signed in** (any of the 3 roles) — checked
  `article.html`'s JS directly and confirmed it actually renders full content unconditionally,
  regardless of session state, in the prototype. The real backend gates `GET /v1/articles/:id`
  behind auth anyway; the browse grid (`GET /v1/articles`, list-only, no body) stays public,
  matching the prototype.
- **Editorial review queue exists, feature-flagged off by default.** An earlier session
  deliberately deferred this (see this doc's git history); the write-flow rebuild session
  reinstated it, but as an opt-in (`ARTICLES_REVIEW_MODE=editorial`) rather than the only mode —
  `instant` (the original, always-published behavior) stays the default so nothing changes for a
  deployment that never sets the env var. `GET`/`PATCH /v1/admin/articles` mirror the
  `manageApplications` admin-review pattern almost exactly, gated by the already-reserved (and
  until now, unused) `manageArticles` permission.
- **Body content, `country`, and `state` are actually persisted.** The prototype's own
  member-submission flow silently drops all three after the preview screen (a bug in the static
  build, not a design choice) — confirmed by reading its `pendingSubmission` object shape directly.
- **Mutations are keyed by the article's UUID**, not array index (the prototype mutates
  `expertly_my_submissions` by raw array position).
- **`author_id` is a real FK, checked against the authenticated session on every read/write.** The
  prototype hardcodes "current user" to the first seed member for its "My Articles" view — there is
  no real ownership check anywhere in the static build to derive one from.
- **AI-drafting is a real, working LLM call**, not the prototype's client-side mock — `POST
  /v1/articles/ai-draft` (see `docs/rest-api.md`) calls whatever provider/model
  `AI_PROVIDER`/`AI_MODEL` name via the Vercel `ai` SDK. This supersedes root `CLAUDE.md`'s
  older "AI-assisted article generation is explicitly deferred" note for this one endpoint —
  everywhere else in the repo that deferral still holds. The write-flow rebuild session expanded
  this from a bare topic/notes/tone call into the full 3-step wizard's brief (practice areas,
  countries, notes, recent developments, advice, tone, extra instructions) plus real source
  ingestion: uploaded PDF/DOCX/TXT documents are parsed to text server-side (`pdf-parse`/
  `mammoth`, magic-byte checked via `file-type`) and pasted links are fetched server-side with
  SSRF guards (`apps/backend/src/ai/fetch-safe.ts` — http(s)-only, DNS-resolved IP checked
  against private/loopback/link-local ranges before and after every redirect hop, 8s timeout,
  3MB cap) — both transient, fed into the prompt for one generate call, never persisted. A
  sibling `POST /v1/articles/ai-refine` re-prompts against the current draft plus the member's
  requested changes (the wizard's inline "refine" box).
- **Cover image is auto-picked via a live Unsplash search, not AI-generated or uploaded.**
  `GET /v1/articles/cover-images?query=` (see `docs/rest-api.md`) proxies Unsplash's search API —
  query is the selected practice area name(s), or a generic finance/legal fallback before any are
  chosen — so `UNSPLASH_ACCESS_KEY` never reaches the client (`apps/backend/src/ai/
  unsplash.service.ts`). Up to 5 results come back per query; "Try another image" cycles through
  them client-side rather than re-querying. An earlier iteration used a small curated local image
  list instead — replaced with real Unsplash search per explicit client feedback. "Include an
  illustration" in the AI wizard's step 3 still only ever produces a markdown table, never a real
  image — no image-generation model is wired anywhere in this repo (root `CLAUDE.md`'s
  AI-integration deferral still holds for that).
- **Topic/title suggestions are a real AI call, not local templates.**
  `POST /v1/articles/suggest-topics` (see `docs/rest-api.md`) is a dedicated `generateText` call
  returning up to 6 title ideas — with no practice area selected yet, the backend samples 3 random
  active ones itself. An earlier iteration used a local template+random-practice-area generator
  instead — replaced with a real model call per explicit client feedback.
- **Article content is authored in a real rich text editor (Tiptap), not a plain textarea.** The
  prototype's write form is a bare `<textarea>` (`.anv-textarea-notepad`) — no formatting at all.
  `apps/frontend/components/articles/RichTextEditor.tsx` adds a toolbar for bold/italic/underline,
  bullet/numbered lists, blockquote, inline code, code block, and links, matching the reference
  GrowXQ repo's own editor choice. Deliberately no headings (would fight the detail page's own
  h2/h3 hierarchy), images, or tables — kept in lockstep with
  `ArticlesService`'s `sanitize-html` allowlist above; a toolbar button with no matching allowed
  tag would silently vanish on save. The AI wizard's plain-text draft is converted to real `<p>`
  HTML (`plainTextToEditorHtml`) before it loads into this editor, rather than one run-on block.

### Not built yet (explicitly deferred)

- Tags — suggested in the write-flow UI (cosmetic, client-derived from services + title keywords),
  never actually persisted — matches the prototype's own tags-are-UI-only behavior.
- AI-generated summary bullet points — a static per-category lookup table in the prototype, not
  real per-article data.
- View/like/comment counters — anonymous, `localStorage`-based in the prototype, unrelated to any
  account; a plausible separate future feature, not part of this CRUD-with-ownership contract.
- Category/country query-param filtering on `GET /v1/articles` (the prototype filters client-side
  over the full published set).

## AI draft generations (`supabase/migrations/0004_tables.sql`)

**Source:** `docs/superpowers/specs/2026-10-03-adaptive-article-ai-flow-design.md` §6 — a new
table, not present in the original static prototype (the prototype's AI drafting was a client-side
mock with no concept of logging).

**Flow:** a write-once audit row per completed `POST /v1/articles/ai-draft` attempt (success or
failure), written fire-and-forget by `AiService` so it never delays or fails the member-facing
response. This is **not** a resumable session store — the wizard flow itself stays stateless,
re-sending its full state with each request; this table exists purely so generation quality,
question usefulness, and failure rates can be reviewed later. A member who abandons the wizard
before clicking Generate leaves no row — a known, accepted gap, not a bug.

### `ai_draft_generations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `author_id` | uuid FK → `profiles.id` | the member who ran the generation |
| `service_ids` | uuid[], default `{}` | **AI-inferred**, not client-sent — the model picks from the real active services list given alongside the brief, validated/resolved to real ids before being logged here; same array/no-FK trade-off as `articles.service_ids` otherwise — this table is audit-only, never validated or joined against `services` on read |
| `countries` | text[], default `{}` | **AI-inferred**, validated against the real countries list (`apps/backend/src/ai/countries.ts`) before being logged here |
| `state` | text | nullable; **AI-inferred** if clearly implied by the brief, otherwise `null` — free text, not validated against a list |
| `source_file_paths` | text[], default `{}` | Storage object paths within the private `ai-draft-sources` bucket for every file the member uploaded in this attempt (PDF/JPEG/PNG/WebP sent to the AI natively, plus TXT — all persisted regardless of kind). Audit-only, same no-FK posture as `service_ids` above. |
| `source_links` | text[], default `{}` | The pasted `sourceLinks` URLs as given, for traceability only — does not imply the AI actually fetched any of them (see `docs/rest-api.md`'s `ai-draft` section for the actual fetch-reliability caveat). |
| `core_answers` | jsonb NOT NULL | `{ notes, recentDevelopments, advice }` as given in the wizard's first step |
| `followup_questions` | jsonb NOT NULL, default `[]` | the full question list `ai-followup-questions` returned (0-10), echoed back by the client as `followUpQuestionsAsked` — kept separate from `followup_answers` so this table can tell "asked but skipped" apart from "never asked" |
| `followup_answers` | jsonb NOT NULL, default `[]` | `{ question, answer }[]` — only the ones the member actually answered |
| `sources` | jsonb NOT NULL, default `[]` | `{ url, title }[]` — deduped citations from the AI SDK's own tool-result metadata, never from the model's self-reported JSON |
| `tone`, `extra_instructions`, `draft_title`, `draft_body` | text | nullable; the generated output and the wizard's finishing-touches fields, for reviewing quality later |
| `include_visual` | boolean NOT NULL, default `false` | the wizard's "include a table if relevant" toggle (`AiDraftArticleRequest.includeVisual`) |
| `provider`, `model` | text | nullable; `process.env.AI_PROVIDER`/`AI_MODEL` at the time of the call |
| `status` | text NOT NULL, check `success`\|`failed` | `'success' \| 'failed'` |
| `error_message` | text | nullable; set only when `status = 'failed'` |
| `latency_ms` | integer | nullable |
| `created_at` | timestamptz | |

RLS enabled with an owner-only select policy (`ai_draft_generations_select_own`), same posture as
`member_profile_edits_select_own` — defense-in-depth only, since the backend's service-role client
is the actual write path. Admins read it through `GET /v1/admin/ai-generations[/:id]`
(🛡️ `manageArticles`, see `docs/rest-api.md`) — the admin "AI generations" log at
`/admin/ai-generations`, which shows every input next to the AI's output and the article it was
saved as (via `articles.ai_generation_id`). Extra index `ai_draft_generations_created_at_idx`
backs that newest-first list. A second private bucket,
`ai-draft-sources`, backs `source_file_paths` above — written only by the backend, no
`storage.objects` policy (see the Storage note under Membership applications).

## Events (`supabase/migrations/0001_extensions.sql`–`0004_tables.sql`)

**Source:** `design/static_html/assets/members.js`'s `EXPERTLY_EVENTS` (the prototype's own event
data) for the field set; the `events` table itself already existed in this schema before any
backend module read from it — see the drift note below.

### `events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | |
| `slug` | text, unique | |
| `description` | text | |
| `short_description` | text, nullable | |
| `cover_image_url` | text, nullable | |
| `start_date` | timestamptz | |
| `end_date` | timestamptz, nullable | single-day events have no end date |
| `timezone` | text, nullable | |
| `event_type` | text, nullable | free-text category (e.g. "Tax", "M&A", "AI & Tech") — not FK'd to `categories`/`services`, the prototype's own category list doesn't line up 1:1 with that taxonomy |
| `event_format` | text, nullable, check `in_person`\|`virtual`\|`hybrid` | |
| `country`, `city`, `venue_name` | text, nullable | |
| `is_free` | boolean, default `false` | |
| `registration_url` | text, nullable | |
| `organiser_name` | text, nullable | |
| `status` | enum `draft`\|`published` | RLS only exposes `published` rows to `select` |
| `created_at`, `updated_at` | timestamptz | |

**`GET /v1/events` (public, published-only) plus direct admin CRUD (`GET`/`POST /v1/admin/events`,
`GET`/`PATCH`/`DELETE /v1/admin/events/:id`) are built.** The public suggestion-queue submission
endpoint is not — `status` already models the moderation state that future session needs, so no
schema change should be required when it ships. See `docs/rest-api.md`'s Events section for the
exact current contract.

## AI search (`supabase/migrations/0001_extensions.sql`–`0004_tables.sql`)

Backend-only: RLS is on with **no policies** and nothing is granted to `anon`/`authenticated`; only
the NestJS service-role client reads or writes these. Functions are `service_role`-only. Extensions:
`vector` (halfvec) and `pg_trgm` (schema `extensions`).

### `search_documents`
One denormalised "card" per published/active member, published article and published event.
One plain table for all three types, told apart by `doc_type` (not partitioned — at this size
every query is a sequential scan, so per-type tables bought nothing; see the index notes below).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint, PK | from `search_documents_seq` |
| `doc_type` | text, check `member`\|`article`\|`event` | leading column of the `(doc_type, source_id, chunk_index)` unique index, which also serves type filters |
| `source_id` | uuid | `member_profiles.profile_id` / `articles.id` / `events.id`; unique with `(doc_type, chunk_index)` |
| `chunk_index` | smallint, default 0 | always 0 today |
| `title`, `search_name` | text | `search_name` = title + firm/organiser, for trigram name matching |
| `content` | text | the card text (line labels like `About:`, `Key clients:` are load-bearing — the judge prompt depends on them). Emails/phones are redacted **before** storing |
| `content_hash` | text | `md5(title \|\| '\n' \|\| content)` |
| `service_ids` `uuid[]`, `countries` `text[]`, `city` | | filter columns |
| `event_start`, `event_end`, `rate_min_cents`, `rate_max_cents`, `is_available`, `doc_date` | | type-specific filters |
| `embedding` | `halfvec(768)` | OpenAI `text-embedding-3-small` at 768 dimensions |
| `embedding_model`, `embedded_hash` | text | a row is "pending" while `embedded_hash is distinct from content_hash` |
| `tsv` | tsvector, generated | title weight A + content weight B |

Indexes: GIN on `tsv`, `search_name` (trigram), `service_ids`, `countries`; btree on `doc_date`;
partial btree on `event_start` (`where doc_type = 'event'`) and `rate_min_cents`
(`where doc_type = 'member'`); partial index on pending rows; one HNSW (`halfvec_cosine_ops`, m=16,
ef_construction=64) over all rows — per-type partial HNSW indexes wouldn't be chosen for
`search_hybrid`'s `doc_type = any(p_doc_types)` filter.

### `search_outbox`
Rebuild to-do list. Triggers `search_sync_*` on `member_profiles`, `member_services`, `profiles`,
`articles`, `events`, `services` call `search_trg()` → `search_enqueue()`. One pending row per
`(doc_type, source_id)` (partial unique index); a duplicate refreshes `enqueued_at`.
Columns: `id`, `doc_type`, `source_id`, `enqueued_at`, `processed_at`, `attempts`, `failed`,
`last_error`, `claimed_at` (set by `search_outbox_claim`; a claim older than 5 minutes is abandoned).
Deleting a source row deletes its card directly in the trigger.

### `search_query_log`
Every question: `id`, `user_id`, `source` (`user`\|`eval`), `question`, `plan` (planner JSON),
`applied`, `result_refs`, `answer`, `degraded text[]`, `ms`, `feedback` (-1/1), `feedback_note`,
`created_at`.

### Functions
`search_hybrid` (meaning + words + names, Reciprocal Rank Fusion; since 2026-10-30 its vector
channel orders by `embedding <=> p_embedding::halfvec(768)` directly so the HNSW index
`search_documents_emb_idx` serves it, with `hnsw.ef_search = 100` and `hnsw.iterative_scan =
relaxed_order` — needs pgvector ≥ 0.8), `search_match_services`,
`search_pending_embeddings`, `search_store_embedding` (rejects stale writes by hash),
`search_enqueue`, `search_trg`, `search_outbox_claim`, `search_outbox_complete` (5 attempts, then
`failed`). Card building, the embedding
loop, rate limiting, caching and settings live in code, not in the database.

### Related grant (not search-specific)
`anon` has column-level `SELECT` on 33 `member_profiles` columns — **not** `contact_email`,
`contact_phone`, `linkedin_url` (contact details) or `application_id`, `renewal_payment_status`
(internal) — and no write privileges. Columns added later are hidden from `anon` until added
to the grant list in `0004_tables.sql` on purpose.

## ⚠️ Resolved: live database vs. migration file drift

A prior session found that the live database didn't match the `0001_initial_schema.sql` file (a
single file at the time) checked into git — live had only `profiles`/`practice_areas`/
`membership_applications` plus the member-directory tables (then in a separate `0002` file), was
missing `profiles.auth_provider`/`timezone`/`consent`/`deletion_reason`, and had no `articles`/
`events`/`consultation_requests`/`peer_connect_*` tables at all, even though git's `0001` defined
them.

**Resolved that session**, while the migration was already being rewritten to fold the member
directory's child tables into JSONB (see below): `0001` and `0002` were consolidated using
`practice_areas` as ground truth (confirmed via every backend module's actual queries — `services`/
`categories` never existed live and is not reintroduced), and the live instance was brought in sync
via an additive reconciliation (new columns/tables only — `profiles` and `membership_applications`
rows were untouched, `ADD COLUMN`/`CREATE TABLE`, only the 8 empty member child tables were
dropped). `articles`/`events`/`consultation_requests`/`peer_connect_*` now exist live, so the
`articles` backend module can be exercised against real data.

**Since then**, the schema was further split into the four dependency-ordered files described in
`supabase/migrations/README.md` (`0001_extensions.sql`, `0002_enums.sql`, `0003_functions.sql`,
`0004_tables.sql`), and `handle_new_user()` (in `0003_functions.sql`) was extended to also set
`auth_provider` (read from Supabase's `raw_app_meta_data`), `last_login_at`, and `consent` on
signup — previously only `email`/`first_name`/`last_name`/`role` were set. These four files are
trustworthy ground truth.

## Member directory & profiles (`supabase/migrations/0001_extensions.sql`–`0004_tables.sql`)

**Source:** `design/static_html/members.html` (directory/search), `member-profile.html` (3099
lines — profile detail, self-edit, consultation-request entry point), `dashboard.html`/
`dashboard-alt-3.html` (two visual treatments of the same member dashboard — confirmed not
materially different from a data-model angle either), `admin-dashboard.html`'s member-management,
verification, and profile-edit-review panels, `assets/members.js`, `assets/admin-data.js` — all
read in full, not spot-checked.

**A correction to `docs/roadmap.md`'s scoping notes**, both confirmed while reading the above in
full for this session:
- **Admin sub-tier permissions was flagged as an open design question — it wasn't one.**
  `assets/admin-data.js:70-99` already has a complete client-side model: `super_admin` (everything),
  `content_manager` (articles/events/perks/templates/learnings CRUD, review applications, no admin
  management), `reviewer` (approve/reject applications & article submissions only), each with an
  explicit permission list (`viewDashboard`, `manageApplications`, `manageArticles`,
  `writeArticles`, `manageEvents`, `deleteContent`, `manageAdmins`, `manageMembers`,
  `manageConsultations`, `manageResources`). This session ports it as real, server-checked
  authorization rather than redesigning it — see `apps/backend/src/auth/constants/admin-permissions.ts`.
- **`keyClients` is real, populated scope**, not a maybe as `roadmap.md` suggested — confirmed
  live data for 6+ members at `member-profile.html:1510`. The base seed data resolves a logo via a
  `domain` field (favicon-service lookup); the self-edit form instead uploads a real file. Both
  collapse to one `logo_url` column (see `member_key_clients` below) — don't keep two rendering
  paths for the same field.

### `member_profiles`

Extends `profiles` 1:1 for `role='member'`. **Revisited this session**: an earlier version of this
table used `id` itself as the FK to `profiles.id` (no separate `profile_id` column) — `id` *was*
the profile id. That's now split: `id` is `member_profiles`' own generated surrogate PK (nothing
else references it), and `profile_id` is a separate, unique-constrained FK to `profiles.id` — the
column every "member_id" elsewhere in this schema (`member_services`, `member_profile_edits`,
`consultation_requests`, `peer_connect_*`) actually points at, and what `MemberDto.id` in the API
response is. This keeps every ownership check (`assertOwner` in `members.service.ts`, RLS
policies) comparing against `auth.uid()` exactly as before — only queries against
`member_profiles` itself changed from `.eq('id', ...)` to `.eq('profile_id', ...)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK, own generated value | internal surrogate key — not exposed in the API, nothing else references it |
| `profile_id` | uuid, unique, FK → `profiles.id` | the "real" identity — this is `MemberDto.id`, and what every other table's `member_id` column references |
| `slug` | text, unique, not null | added 2026-09-27. Server-generated at provisioning time (`ApplicationsService.reviewApplication()`, from the applicant's name) via `generateUniqueSlug()` — the same mechanism `events`/`articles` use for their own slugs (`apps/backend/src/common/slugify.ts`): kebab-case, `-2`/`-3`/... suffix on collision. Never regenerated afterward, even if the member's name changes later — same "permanent identifier" rule those slugs follow. Exposed on `MemberListItemDto`/`MemberDto`, and since 2026-09-27 the routing key for profiles: `GET /v1/members/:slug` and the frontend's `/members/[slug]`. `profile_id` (UUID) stays the key for owner/admin write routes and every foreign key. |
| `headline`, `bio` | text | |
| `firm_name` | text, nullable | **Null, not the prototype's literal `'Independent'` string** — render that label at the UI layer. Baking display text into data was a deliberate thing *not* to reproduce. |
| `firm_website` | text, nullable | Added 2026-09-29 as `NOT NULL`, relaxed to nullable 2026-10-03 — required for every *new* application regardless of `firm_name` (any well-formed URL accepted — a personal site or a LinkedIn page, not just a firm domain — enforced at submit time by `ApplicationsService.assertComplete()`), but a small number of applications submitted before that check existed may genuinely have none; approving one of those now inserts `null` rather than failing. Every read path (`MembersRepository`, both frontend profile views) already treated this as nullable. |
| `years_of_experience` | smallint, check 0–60 | drives tier, same shape as the application's own field |
| `rate_min_cents`, `rate_max_cents` | int, check `max > min` | **Named to match `membership_applications.rate_min_cents`/`rate_max_cents`** — same concept, not `fee_range_*` as an earlier draft of this section had it |
| `rate_currency` | text, default `'USD'`, check `^[A-Z]{3}$` | ISO 4217 code — the prototype only ever shows `'$'`, not a real currency code; every seed profile is USD, stored properly so a future non-USD member doesn't need a schema change |
| `member_tier` | enum `membership_tier` (shared with applications) | admin-overridable at approval |
| `is_available` | bool, default `true` | Member-controlled via `PATCH /v1/members/:id` (`isAvailable`; applies immediately, no review). |
| `availability_notes` | text, nullable | Same endpoint; ≤200 chars, shown under the status. |
| `contact_email`, `contact_phone`, `linkedin_url`, `website` | nullable | editable via the `contact` self-edit section |
| `work_email` | citext, nullable | Optional professional address, separate from `contact_email` (application / LinkedIn-sourced). Editable via the `contact` section; shown on the profile contact tab only when set. |
| `is_verified` | bool, default `false` | the overall "GrowXQ Verified" badge — distinct from the per-item `is_verified` flags on credentials/testimonials |
| `photo_path` | text, nullable | Same convention as `membership_applications.photo_path`: a Storage path within the (public) `application-assets` bucket, copied verbatim from the source application's `photo_path` on approval — same bucket, same file, nothing to move. Or a legacy/seed full external URL. Resolved to a plain, permanent URL at read time (`MembersService`/`ArticlesRepository`) — **never a signed URL**, since this column is read back directly with no read-time refresh. (An earlier version of this column, named `photo_url`, held a baked-in 1-hour signed URL that went dead an hour after approval — that was the original bug this design fixes.) Since 2026-10-21 the member can replace it via `PATCH /v1/members/:id` (`photoUploadPath`), which writes a new `members/<id>/profile-photo-<uuid>.<ext>` path in the same bucket (live immediately, no review). |
| `status` | enum `active`\|`deactivated` | admin-controlled; deactivating does not delete the row |
| `application_id` | uuid FK → `membership_applications.id`, nullable | set when provisioned via an approved application (that approval endpoint is still deferred — see `docs/rest-api.md`); null for a member added directly by an admin |
| `membership_started_at` | timestamptz, default `now()` | |
| `renewal_payment_status` | enum `paid`\|`pending`\|`overdue`, nullable | manual admin override only — **null is the normal state**, meaning "compute the due-state, don't trust a stale stored value" |
| `created_at`, `updated_at` | timestamptz | |

**Not stored as columns, computed at read time:** the directory list's `"18y"`/`"$420/hr"`-style
display strings are prototype-only formatting of `years_of_experience`/`rate_min/max_cents` —
format them in the API/frontend, don't persist a second, parallel string representation of the same
fact. Same for the "Budding" tier badge (`years_of_experience < 12`, purely derived from
`member_tier`).

**Renewal is deliberately minimal** — just `membership_started_at` + `renewal_payment_status` here.
Due-state (`active`/`due-soon`/`overdue`) is always computed (`due_date = membership_started_at +
12 months`; `overdue` past due, `due-soon` within 30 days of it), never persisted — nothing to keep
in sync. The 12-month/30-day numbers are hardcoded constants in
`apps/backend/src/members/members.service.ts`, not an admin-configurable setting — nothing consumes
them differently at other values, and no automation (reminder emails, auto-suspension) acts on the
due-state today, so a settings table + admin API would have been speculative flexibility with no
current consumer.

### `member_services`

Real join table to `services` (renamed from `practice_area_id` to `service_id`, plus a nullable
`custom_label` for `is_custom` entries — not JSONB like `service_preferences`/`article.service_ids`
elsewhere in this schema) — the directory's own search filters by service/category, a need those
write-once/read-as-a-whole tables don't have. Composite PK `(member_id, service_id)`, real FK
(this table *can* have one, unlike the JSONB-array columns, since it's a real join table).

The composite PK means at most one row per `(member, service)` — this bit twice before the
2026-09-26 fix: (1) an applicant could pick the same `serviceId` (almost always the generic
"Other" one) in more than one of their 3 `service_preferences` priority slots, so on admin approval
the second `insertMemberServices` row hit the PK and threw; now rejected at submit time with `400`
(`ApplicationsService.assertActiveAndResolveServices`) and the frontend dedupes the dropdown
options so it can't even be selected. (2) Approval used to insert one row per submitted preference
with no way to approve fewer — now the admin explicitly picks exactly one via
`AdminApplicationReviewRequest.approvedServiceId`, so a member's `member_services` reflects one
deliberately-approved service, not everything they applied with.

### 8 jsonb sections on `member_profiles`

**Revisited this session** — an earlier version of this doc argued these needed to be real child
tables (individually editable via the self-edit moderation flow, plus a per-item verification flag
on two of them), and that reasoning is stale. Looking at the actual write pattern: the self-edit
flow (`member_profile_edits` below) always replaces a **whole section** at once — never a single
item — so a `jsonb` array column matches that "one UPDATE" semantics better than delete+insert
across a child table. The one cited reason for tables that didn't hold up was "a future employer
search" — speculative, nothing currently needs it, and CLAUDE.md's own principle is not to design
for hypothetical future requirements. `member_services` (below) stays a real join table — that one
has a *today* need (real FK to `services`, filtered on directly by the directory's service/category
search) that these sections don't share.

Each is `jsonb not null default '[]'`, checked `jsonb_typeof(...) = 'array'`, stored as an array of
objects already shaped like the API's camelCase response type (`MemberWorkExperience[]`, etc., in
`packages/shared-types/member.ts`) — no snake_case/camelCase mapping needed on read. Each item's
`id` is assigned by the application layer (`randomUUID()` in `members.service.ts`), since there's
no DB-generated id the way a real table's `uuid` PK would provide.

| Column | Item shape | Notes |
|---|---|---|
| `work_experiences` | `title`, `company`, `startMonth?`, `startYear`, `endMonth?`, `endYear`, `isCurrent`, `description`, `isVerified` | Stored newest-first; an end before its start is rejected server-side on application save and on self-edit submit/approval. Overlapping ranges are allowed (concurrent roles / sub-roles at one firm) — the frontend shows a non-blocking warning only (changed 2026-10-21). |
| `educations` | `degree`, `institution`, `field`, `endYear`, `isVerified` | |
| `engagements` | `title`, `organization`, `clientName` (required on submit), `clientEmail?`, `verificationMethods[]` (`engagement_letter`\|`client_deliverable`\|`mail_confirmation_pdf`\|`newsletter_transaction_update`\|`other`), `verificationMethodOther?`, `year`, `url`, `isVerified`, `proofAttachments[]` | `clientName` is null only on legacy/seeded rows; `clientEmail` is owner/admin-only on read |
| `qualifications` | `name`, `year` | **confirmed distinct from `credentials`** — no issuing body, no verification flag |
| `credentials` | `name`, `issuingBody`, `year`, `isVerified` | per-item verification flag lives inside the jsonb object — no per-item admin query/index need today, only ever read back as part of the whole profile |
| `testimonials` | `quote`, `clientName`, `clientTitle`, `clientCompany`, `clientEmail?` (owner/admin-only on read, for random verification — 2026-10-21), `serviceName`, `occurredOn` (ISO date string), `isVerified` | `occurredOn` is a real date, not the prototype's free-text `"March 2026"` — format at render time. No `rating`/star field — confirmed absent from every seeded testimonial; don't confuse with the unrelated Peer Connect post-meeting rating. |
| `awards` | `title`, `issuingBody`, `year`, `description`, `isVerified`, `proofAttachments[]` | |
| `keyClients` (`key_clients` column) | `name`, `logoUrl`, `isVerified`, `proofAttachments[]` | reconciles the two logo sources noted above into one field. Max 20 per member. |

**Per-item `isVerified` (2026-10-10).** Every list section's items carry `isVerified` (set by the admin's per-item decision: `approved_verified` = true, `approved_hygiene` = false; application-derived work history/education are true). **`proofAttachments` now persist on live items** (engagements, testimonials, awards, key_clients) so a post-approval edit can prefill them; they are exposed by `GET /v1/members/:slug` only to the owner and admins, never to other viewers. Items edited by the member keep their `id` (the payload may carry the live `id`).

`qualifications` and `credentials` have no self-edit or admin-write endpoint yet (not in
`MemberEditSection`, not in `UpdateAdminMemberDto`) — that gap predates this change and carries
forward unchanged, just as unused `jsonb` columns instead of unused tables.

### `member_profile_edits` — the self-edit moderation queue

Replaces the prototype's two redundant `localStorage` keys (`PROFILE_EDITS` + `PROFILE_OVERRIDES` —
an "override" is just the payload of the latest `verified` edit for that member+section) with one
table — a legitimate simplification, not a shortcut being flagged.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `member_id` | FK | |
| `section` | enum (`headline_bio`, `contact`, `engagements`, `education`, `work_experiences`, `key_clients`, `testimonials`, `awards`) | |
| `payload` | jsonb | shape varies by section |
| `proof_file_url`, `proof_link` | text, nullable | only used for the `education`/`work_experiences` batch-proof case (see below) |
| `status` | enum `pending`\|`verified`\|`rejected` | |
| `review_note` | text, nullable | |
| `item_reviews` | jsonb, nullable | Per-item admin decisions for array sections: `[{ index, decision: 'approved_verified'\|'approved_hygiene'\|'rejected', reason }]` (`index` into the immutable `payload`). Null for `headline_bio`/`contact`, whole-edit reviews, and pending rows. |
| `reviewed_by` | FK → `profiles.id`, nullable | |
| `reviewed_at` | timestamptz, nullable | |
| `submitted_at`, `created_at`, `updated_at` | timestamptz | |

**Status conventions (2026-09-27, no schema change):** at most one `pending` row per
`member_id` + `section` — a new submission closes older pending rows as `rejected` with
`review_note = 'Replaced by a newer submission.'` and `reviewed_by = null` (a null reviewer on a
rejected row means "replaced", not an admin decision). A real rejection always has `reviewed_by`
set and a non-blank `review_note`, which the member sees on their profile. On approval of a
`key_clients` edit, each item's `logoUploadPath` (private `member-proofs` path) is copied into the
public `application-assets` bucket under `members/<memberId>/client-logos/` and replaced by a
public `logoUrl` in the live `key_clients` column.

**Proof requirement varies by section — confirmed from the actual save logic, not assumed:**
`headline_bio`/`contact` need no proof at all; `education`/`work_experiences` need one shared proof
for the whole batch submission (the `proof_file_url`/`proof_link` columns above); `engagements`/
`testimonials`/`awards`/`key_clients` need proof (or, for `key_clients`, a logo asset) per item,
embedded directly inside each element of the `payload` array — which is why `payload` stays `jsonb`
rather than becoming more structured columns.

For `engagements`/`testimonials`/`awards`, that per-item proof is `proofAttachments?:
{type: 'file'|'link', url: string, label: string}[]` (`ProofAttachment` in
`packages/shared-types/member.ts`) — a member can attach any mix of multiple files and links to a
single item, not just one of the two. (An earlier build of the self-edit UI only wired up one
shared file-or-link widget for the whole modal, same shortcut the static prototype itself takes —
that's now fixed to match this per-item design rather than left as a divergence.) `url` is a
Storage object path for `type: 'file'` (from `POST /v1/members/:id/uploads`, one call per file) or
the pasted URL for `type: 'link'`; `label` is the display text (original filename, or the link
itself). `proofAttachments` is stripped out when an approved edit is written into the live
`member_profiles` column (see below) — it's moderation evidence, never part of the public profile.

On approval, `payload` becomes the live value for that member+section: for the array-shaped
sections, the matching `jsonb` column on `member_profiles` is rebuilt in a single `UPDATE` from the
payload **per item** (2026-10-10): accepted items are written (id kept if the payload item carried a live `id`, else freshly generated; `isVerified` per decision), a rejected item falls back to its live version (or is dropped if it was new), live items the member left out are removed, and if every item is rejected the live column is untouched; for `headline_bio`/`contact`, the
matching `member_profiles` columns are overwritten directly. This is a deliberate whole-section-
request workflow (the admin reviews one edit request at a time, deciding per item for array sections) — keep it
as-is, it's not a prototype shortcut.

**Proof is optional for members everywhere (2026-10-10).** No submission is rejected for missing proof. Proof only gates the *verified* outcome: the admin can approve an item `approved_verified` only if it has proof (item `proofAttachments`, or for `education`/`work_experiences` the edit-level `proof_file_url`/`proof_link`).

**A real shortcut, flagged rather than reproduced:** the prototype's self-edit UI collapses every
array item down to one free-text line on save (`parseRowText`, `member-profile.html:2345-2355` —
literally `{ description: text }` for everything except testimonials/awards), losing the structured
fields on edit. The backend contract here accepts the same structured payload the base data already
uses — a future frontend session should build a real structured edit UI, not carry the flattened
one forward.

### Design decisions — divergences from the static prototype

- **Full profile detail requires sign-in** (`GET /v1/members/:slug`) even though the directory list
  itself (`GET /v1/members`) is public — a deliberate product decision (the prototype's own
  auth-wall on this page reads more as an engagement/signup gimmick than a real privacy need, but
  the call was made to keep it gated rather than remove it).
- **`admin_role` is server-checked**, not trusted from any client-asserted value — same
  fresh-DB-read posture `RolesGuard` already uses for the plain `admin` role, extended one level
  deeper. See `apps/backend/src/auth/guards/admin-permission.guard.ts`.
- Dashboard's "Referrals" count and gamified goal (`"2/5"`) — confirmed zero backing logic anywhere
  in the prototype, purely decorative mock data (`dashboard.html:352`). Explicitly dropped, not
  built.
- "Schedule a Call" — the prototype's own code comment confirms this is frontend-preview-only,
  pilot-gated to one member, no backend wiring intended (`member-profile.html:1968-1969`). Not a
  shortcut to reverse-engineer.

### Not built yet (explicitly deferred)

- File/proof upload itself — this migration adds the columns to receive a Supabase Storage path
  (`proof_file_url`, per-item `proofFile`-shaped fields inside `payload`, each `key_clients` item's
  `logoUrl`), but the signed-upload-URL endpoint and the Storage bucket configuration are the
  `apps/backend/src/members/` module's job, not the migration's — see `docs/rest-api.md`.
- The admin approve/reject write path for `member_profile_edits` (replace-child-rows-on-approval
  logic) — schema is ready; confirm against `docs/rest-api.md` whether the endpoint landed in the
  same session.
- Promoting an approved `membership_applications` row into a real `member_profiles` row (flips
  `profiles.role` to `member`) — still blocked on the applications-side admin-review endpoint,
  itself still deferred (see that section above).

## Consultations (`supabase/migrations/0004_tables.sql`)

**✅ Applied to the dev database:** the `requester_name`/`requester_contact_email`/
`requester_phone` columns and the `consultation_messages` table (both below, for reference —
already live, don't re-run).

```sql
alter table public.consultation_requests
  add column requester_name text not null,
  add column requester_contact_email text not null,
  add column requester_phone text not null;
```

```sql
create table public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index consultation_messages_request_id_idx on public.consultation_messages (request_id, created_at);

alter table public.consultation_messages enable row level security;

create policy consultation_messages_select_participant
  on public.consultation_messages for select
  using (
    exists (
      select 1 from public.consultation_requests cr
      where cr.id = request_id
        and (cr.requester_id = auth.uid() or cr.member_id = auth.uid())
    )
  );
```
(Historical snippet — the live policy is `to authenticated` with `(select auth.uid())`, see
"Conventions" under Identity & Auth.)

**⚠️ Pending: the migration below has NOT been applied yet.** Safe — no backfill needed
(pre-production):

```sql
alter table public.consultation_requests
  add column rating smallint check (rating between 1 and 5);
```

Then regenerate types for real: `cd apps/backend && pnpm gen:types` (needs `SUPABASE_DB_URL` set
to the project's direct Postgres connection string — Project Settings → Database → Connection
string — which isn't configured yet; this can't be run until that's filled in) — this replaces the
provisional hand-edits currently in `apps/backend/src/supabase/database.types.ts` (see the
comments there).

**⚠️ This one breaks the whole feature, not just the rating endpoint.** `rating` was added to
`ConsultationsRepository`'s shared `CONSULTATION_COLUMNS` list — the same column set every
consultation read/write uses (`findById`, `findByRequesterId`, `findByMemberId`, `findAll`,
`insert`, `updateStatus`, `updateRating`). Until the column above is applied, **every** consultation
endpoint returns `500` against a live database, including the ones that were already working
(`/mine`, `/received`, creating a request, updating status) — apply this migration immediately
after deploying this change, not at your convenience.

### `consultation_requests`

Created ahead of any API work in the initial schema migration (see the "live database vs.
migration file drift" note above) — this session adds the real contract on top of it.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `requester_id` | `uuid not null` | FK → `profiles.id`, cascade delete |
| `member_id` | `uuid not null` | FK → `profiles.id`, cascade delete |
| `requester_name` | `text not null` | **New.** Collected on the request form — independent of the requester's account profile, since the prototype's modal lets the value differ from it |
| `requester_contact_email` | `text not null` | **New.** Same reasoning — distinct from `profiles.email` |
| `requester_phone` | `text not null` | **New.** Distinct from `profiles.phone` |
| `service_id` | `uuid` | FK → `services.id`, set null on delete. Wired up by a later product requirement (service/category picker, validated against `member_services`) — exactly one of `service_id`/`custom_service_label` is set per row |
| `custom_service_label` | `text` | The "Other" free-text entry, set only when `service_id` is null |
| `subject` | `text` | **Unused**, no UI for it |
| `message` | `text not null` | The "Description of Work Required" field |
| `description` | `text` | **Unused** |
| `status` | `consultation_status enum` | `'pending' \| 'completed' \| 'declined'`, default `'pending'` |
| `scheduled_at` | `timestamptz` | **Unused** — no scheduling in this feature (see Peer Connect) |
| `response_message` | `text` | The member's required reason when transitioning `pending` → `completed`/`declined` (added by a later product requirement — not in the original design prototype). Null while `status` is `'pending'` |
| `rating` | `smallint` | **New, not yet applied (see above).** The requester's 1-5 rating of the conversation — settable only once `status` is `'completed'` (`rating` on `PATCH /v1/consultations/:id`), check-constrained to 1-5 |
| `created_at` / `updated_at` | `timestamptz not null` | — |

### `consultation_messages`

Added by a later product requirement — a free-form back-and-forth thread on a request, separate
from the one-time `response_message` reason above. Either participant can post while `status` is
`'pending'`; once the member decides, the thread closes to new messages (history stays readable)
and the requester rates the conversation (`rating` on `consultation_requests`) instead.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `request_id` | `uuid not null` | FK → `consultation_requests.id`, cascade delete |
| `sender_id` | `uuid not null` | FK → `profiles.id`, cascade delete. Whichever side (requester or member) wrote it — not a role column |
| `body` | `text not null` | 1–2000 chars, enforced server-side |
| `created_at` | `timestamptz not null` | No `updated_at` — append-only, no edit/delete in this feature |

### Design decisions

- **Three new `not null` text columns** (`requester_name`/`requester_contact_email`/
  `requester_phone`) added this session — the original schema-only table had no way to store the
  contact details the request-creation modal actually collects, which are independent of the
  requester's account profile (`profiles.email`/`profiles.phone`). No backfill needed
  (pre-production, zero rows existed).
- **Three columns left unused** (`subject`, `description`, `scheduled_at`) — present in the
  schema-only table ahead of any product decision; no corresponding field exists anywhere in this
  feature. Left in place (harmless, nullable) rather than dropped. (`response_message` was in this
  group at this doc's original writing but is now wired up — see the table above.)
- **`consultation_messages` added after this doc's original writing** — a later product
  requirement for genuine back-and-forth between requester and member, separate from the one-time
  `response_message` reason. See the table above.
- **`rating` added after this doc's original writing** — closes the loop on the thread above: once
  the member decides, the requester's "say something" action shifts from posting another message
  to rating the conversation 1-5. A plain `smallint` with a check constraint rather than a separate
  table — one rating per request, no history/edit trail needed.
- **`service_id`/`custom_service_label` wired up after this doc's original writing** — a later
  product requirement added a service/category picker to the request form (not in the original
  design prototype), backed by these two already-existing-but-dormant columns rather than a schema
  change. Exactly one is set per row: `service_id` when the requester picked one of the target
  member's own offered services (validated server-side against `member_services` — never trusted
  as an arbitrary `services.id`), `custom_service_label` when they chose "Other" and typed free
  text instead.
- **`GET /v1/consultations/received` is scoped to `member_id = caller.id`** — the prototype's own
  `consultation-requests.html` has no ownership filter at all (every member sees every request in
  the shared `admin-data.js` store); the real backend does not reproduce that.
- **No rate-limit table/column** — the `CONSULTATION_REQUEST_LIMIT`/`CONSULTATION_REQUEST_WINDOW_DAYS`
  window is computed at request time from `consultation_requests.created_at`, no extra schema
  needed. See `docs/rest-api.md`'s Consultations section.
- **No schema for the pending-duplicate cooldown either** — same reasoning: a query against
  existing `requester_id`/`member_id`/`status`/`created_at` columns (`findLatestPendingToMember`)
  is enough. A later product requirement, added after this doc's original writing — see
  `docs/rest-api.md`'s `POST /v1/consultations` section for the exact rule.

### Not built yet (explicitly deferred)

- Everything under the three remaining unused columns above.
- Peer Connect-style "Schedule a Call" scheduling — separate feature, own session.
- Resetting a decided (`completed`/`declined`) row back to `pending` — the admin dashboard
  prototype has a "Reset" action; no product decision has been made on whether a decided request
  should be reopenable, so no schema/endpoint support exists for it.
- Deleting a `consultation_requests` row — the admin dashboard prototype has a "Delete" action
  gated by a `deleteContent` permission; no product decision has been made on retention/deletion
  policy for this table, so no endpoint exists for it.

## Perks, Learnings & Collections — US-14

Implemented schema: `0004_tables.sql` (already applied in dev before this API session).
Seed: `0008_seed_resources.sql`: 21 coming-soon perks, 20 videos, 5 learning playlists and
5 perk stacks; `0009_seed_templates.sql`: 12 members-only templates and 3 template kits. Seeded images are bucket-relative resource-assets paths. All 62 images live in
Supabase Storage; the API expands those paths into public URLs. Local source copies and
upload helpers are deliberately not kept in the repo (`supabase/seed-assets/` is gitignored). No new schema migration was needed to complete the API.

Storage content is managed separately from source code. A fresh Supabase project must restore
or copy the `resource-assets` bucket from a Storage backup, preserving the object paths used by
`0008_seed_resources.sql`. Running SQL seeds alone does not restore image objects, and the same applies to the
private `template-files` bucket behind `0009_seed_templates.sql`. Maintain that
backup outside the Git repository; do not use the development bucket as the only backup.

- **perks**: UUID PK; unique slug; product name/category/tagline/description/products; public
  website/logo/cover; separate nullable user/member offer text, coupon code and redemption URL;
  coming_soon/live status; terms/expiry; featured/order/active flags; timestamps. DB checks enforce
  HTTPS URLs and that any tier's non-null offer has a code or redemption URL. The API additionally
  checks blank values, requires offer text for redemption details and requires at least one valid
  tier before publishing live.
- **learnings**: UUID PK; title/summary; youtube/file provider and confidential HTTPS video URL;
  own-copy thumbnail; channel/duration/category/level/audiences; auto/open/members access;
  featured/order/active flags; generated English search tsvector and timestamps. Public queries
  never return video URLs to unauthorized viewers. `auto` is client-open only for the first
  stored video ID of an active learning_playlist. Five seeded videos qualify.
- **collections**: UUID PK; learning_playlist/perk_stack kind; unique `(kind, slug)`;
  title/description/audiences; ordered `item_ids uuid[]`; cover/order/active flags; timestamps.
  Empty arrays are valid. Array order is playback/display order. The API validates UUIDs against
  the correct table on every write; kind cannot be changed after creation. Full-array updates
  are last-write-wins. Inactive children are withheld publicly, not removed from the stored array.

`collections_prune_item()` in `0003_functions.sql` runs AFTER DELETE on perks and learnings,
removing deleted IDs from all arrays transactionally. Arrays do not carry foreign keys; API
validation and deletion pruning are separate protections. A concurrent reference write racing
with deletion is not FK-protected; public response assembly drops missing rows safely.

All three tables have RLS enabled, no browser policies, and all table grants revoked from anon
and authenticated. Only the backend service role accesses raw rows. Role-specific response
shaping, verified optional bearer auth and admin `manageResources` authorization live in the
Resources module. The public Storage bucket is for non-confidential images; do not place gated
videos or coupon secrets in image assets. Schema details and access rules: REST API US-14 section.
Templates and per-user progress/saves/notes are explicitly deferred.

### templates (added 2026-10-30)

Downloadable starter documents. **All members-only.** Kits are `collections` rows with
`kind = 'template_kit'` (the kind check now allows `learning_playlist`, `perk_stack`,
`template_kit`), so no extra table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique | server-generated from `title` |
| `title`, `description` | text | |
| `category` | text check | `Audit`, `Tax`, `Legal`, `Corporate & compliance`, `Practice management` |
| `highlights` | text[] | short "what's inside" bullets |
| `file_type` | text check | `docx`, `xlsx`, `pptx`, `pdf` |
| `file_path` | text | object path in the **private** `template-files` bucket (`starter/…` seed files, `uploads/<uuid>.<ext>` admin uploads). Never returned to non-admins |
| `file_name` | text | download name (`Content-Disposition`) |
| `file_size_bytes` | int > 0 | |
| `preview_image_url` | text, nullable | public teaser image path in resource-assets (`templates/previews/<slug>.jpg`) |
| `audiences` | text[] ⊆ tax/legal/audit | |
| `is_featured`, `sort_order`, `is_active` | | |
| `search_tsv` | tsvector, generated | title + description; not indexed (index dropped 2026-10-30 — nothing reads it yet; add `using gin (search_tsv)` with the planned library search) |
| `created_at`, `updated_at` | timestamptz | `set_updated_at` trigger |

RLS on, all grants revoked from `anon`/`authenticated`; `collections_prune_item()` also fires on
template delete. The `template-files` bucket is private with no storage policies — files are only
reachable through 60-second signed URLs minted by the API.
