# Expertly — Database ERD

Derived per-feature from `design/static_html/`, per `CLAUDE.md`'s "fixed contract, derived once"
convention — not a speculative upfront spec. Grows as each feature's backend session lands.

## Identity & Auth

See `supabase/migrations/0001_initial_schema.sql` and [`docs/auth.md`](auth.md) — `profiles`
table, `role` enum (`client`/`member`/`admin`), Supabase Auth integration.

`handle_new_user()` reads both our own `signUp()` metadata keys (`first_name`/`last_name`) and the
OIDC standard claim names LinkedIn's integration actually populates (`given_name`/`family_name`),
so both signup paths populate real names instead of silently leaving LinkedIn signups blank.

## Membership applications (`supabase/migrations/0001_initial_schema.sql`)

**Source:** `design/static_html/apply.html` and `onboarding_form.html` (two UI iterations of the
identical 5-step wizard — LinkedIn Import → Identity → Background → Services & Rates → Review &
Submit — same fields in both, so they don't fork this schema) plus `review.html` (post-submit
status page, no additional data).

**Flow:** a signed-in `client` submits one application in a single request (the wizard's multi-step
UI is frontend-only state; nothing is persisted until final submit — the design has no
save-and-resume). Approving an application (a separate, deferred admin feature) is the only path
that will create a `member_profiles` row and flip `profiles.role` to `member`; not built yet.

### `membership_applications`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `applicant_id` | uuid FK → `profiles.id` | |
| `status` | enum `submitted`\|`under_review`\|`approved`\|`rejected` | default `submitted` |
| `photo_url` | text | |
| `first_name`, `last_name` | text NOT NULL | |
| `contact_email` | citext NOT NULL | deliberately separate from `profiles.email` (work vs. login email) |
| `phone_country_code`, `phone` | text | optional |
| `region` | enum (7 values: `asia_pacific`…`africa`) | NOT NULL |
| `country` | text NOT NULL | free text in the design (fixed option list + "Other"), not its own lookup table yet |
| `state`, `city` | text | optional |
| `linkedin_url` | text NOT NULL | |
| `bio` | varchar(500) NOT NULL | |
| `years_of_experience` | smallint, check 0–60 | |
| `work_experiences` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | see below — not a child table |
| `educations` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | see below |
| `service_preferences` | jsonb, check `jsonb_typeof(...) = 'array'`, default `[]` | see below — not a join table |
| `rate_min_cents`, `rate_max_cents` | int, check `max > min` | USD/hr |
| `selected_tier` | enum `budding_entrepreneur`\|`seasoned_professional` | auto-derived from `years_of_experience` at submit (>12yr → seasoned); admin can override — but that override applies to the eventual `member_profiles` row, not this immutable submission record |
| `billing_period` | enum `monthly`\|`annual` | |
| `list_price_cents` | int | price snapshot at submission time |
| `coupon_code` | text, nullable | free text; validity checked in application code, no `coupons` table (deliberate — see below) |
| `discount_amount_cents` | int, default 0 | |
| `amount_due_cents` | int, check `>= 0` | |
| `payment_status` | enum `pending`\|`waived`\|`paid` | only `waived` is reachable without a real payment gateway; `paid` reserved for later |
| `linkedin_import_consent` | bool | |
| `terms_version_agreed`, `privacy_version_agreed` | text | e.g. `"1.0"` |
| `background_check_consent` | bool NOT NULL | |
| `reviewed_by` | uuid FK → `profiles.id`, nullable | deferred admin feature — column exists, no endpoint writes it yet |
| `reviewed_at`, `rejection_reason` | nullable | ditto |
| `created_at`, `updated_at` | timestamptz | |

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

**`service_preferences` is JSONB too**, not a join table — `[{ practiceAreaId, priority }, ...]`,
up to 3 entries. This was reconsidered a second time: the original relational design had a real
justification (a genuine FK to `practice_areas`, guaranteeing every preference points at a real,
existing row) versus a weak one ("might want to query 'who wants M&A Tax' someday" — speculative,
nothing in the current build needs it, retracted). The FK-integrity argument was real, but the
decision was made to accept that trade-off for schema simplicity anyway.

**This is a load-bearing trade-off, not a shortcut to forget about**: with no FK, nothing at the
database level stops a `service_preferences` entry from referencing a `practiceAreaId` that
doesn't exist (or no longer does — the referenced practice area is later renamed or deactivated).
**Every write path must validate each `practiceAreaId` against a live query of `practice_areas`
before insert/update** — there is no CASCADE/RESTRICT safety net here the way there is elsewhere
in this schema. `practice_areas` itself is still a real table specifically so this validation (and
the frontend's dropdown options) has something to check against.

### `practice_areas`

`id`, `name` (unique), `is_active`, `category` (`supabase/migrations/0001_initial_schema.sql`).
Seeded with the 12 real practice areas
from `design/static_html/assets/members.js`'s `EXPERTLY_PRACTICE_AREAS` (M&A Tax, Transfer
Pricing, Corporate Law, Capital Markets, IP & Technology, Banking & Finance, Dispute Resolution,
Private Equity, Antitrust, Restructuring, Indirect Tax, Compliance). Will also back the future
member directory's practice-area filter — same taxonomy, not duplicated.

**`category`** — enum `taxation`\|`legal`\|`finance_advisory`, NOT NULL. Backs the category-pill
filter in `design/static_html/onboarding_form.html`'s service-preference step. The mapping is
sourced directly from `design/static_html/assets/onboarding-form.js`'s own authoritative
category-per-practice-area list, not guessed — notably **not** a naive legal-vs-finance split:
Banking & Finance is categorized `legal`, while Antitrust and Compliance are `finance_advisory`.

| Category | Practice areas |
|---|---|
| `taxation` | M&A Tax, Transfer Pricing, Indirect Tax |
| `legal` | Corporate Law, IP & Technology, Banking & Finance, Dispute Resolution |
| `finance_advisory` | Capital Markets, Private Equity, Restructuring, Compliance, Antitrust |

Not region-scoped (no `country`/`city` on this table) — a deliberate call, not a deferred one: a
practice area like "M&A Tax" means the same thing everywhere, so regional filtering belongs on the
*member's* own location (a future `member_profiles` field), not on the taxonomy itself. None of
the 12 current areas are jurisdiction-bound the way something like "GST" would be; revisit only if
a genuinely region-specific practice area is added later.

### Design decisions

- **No `coupons` table.** Deliberately kept as a free-text field checked against application-code
  logic, not a DB-backed lookup — simplest thing that works for "show a code, zero the amount," no
  admin UI exists to manage a real coupons table yet anyway. Revisit if/when coupons need to be
  admin-manageable.
- **`country` is free text**, matching the design's fixed-but-not-database-backed option list —
  not normalized into its own table for this feature; revisit if a future feature needs to query/
  filter by country as a first-class entity.
- Migration verified end-to-end against a real (throwaway, local) Postgres instance before being
  considered final — three separate passes as the schema was revised (child tables → JSONB, then
  service preferences relational → JSONB): migrations apply cleanly in sequence each time, the
  `rate_max > rate_min` check constraint correctly rejects invalid data, and every
  `jsonb_typeof(...) = 'array'` check correctly rejects malformed (non-array) JSON on every JSONB
  column, including `service_preferences`.

## Articles (`supabase/migrations/0001_initial_schema.sql`)

**Source:** `design/static_html/articles.html` (browse grid + write flow), `article.html` (detail
page), `admin-dashboard.html`'s article panels, and `assets/admin-data.js`/`article-engagement.js`
— read in full, not spot-checked, per this doc's own methodology.

**Flow:** a signed-in `member` (or `admin`) writes an article; it's `published` immediately — no
editorial review queue this iteration (the prototype's `pending → published/rejected` admin
approval workflow was explicitly considered and deferred, not overlooked). Owner or admin can
later flip `status` back to `draft` (self-service unpublish) via `PATCH`.

### `articles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `author_id` | uuid FK → `profiles.id` | |
| `status` | enum `draft`\|`published` | default `draft`; `POST` always creates `published` |
| `title` | text | |
| `body` | text | full article content |
| `excerpt` | text | **always server-derived** from `body` (truncated to ~200 chars on a word boundary) — never accepted from the client |
| `read_time_minutes` | smallint | **always server-derived** from `body`'s word count (`words / 200`, min 1) |
| `cover_image_url` | text | |
| `practice_area_ids` | uuid[], default `{}` | see below — not a join table, same trade-off as `service_preferences` |
| `country` | text NOT NULL | |
| `state` | text | optional |
| `created_at`, `updated_at` | timestamptz | |

**`practice_area_ids` is a native array, not a join table** — the write form's practice-area picker
is genuinely multi-select against the same 12-item taxonomy already in `practice_areas` (the
browse grid's single `category` string is a *display* convenience in the prototype, joining
multiple selections with commas — not the real relationship, so the real schema doesn't reproduce
it). Same load-bearing trade-off as `membership_applications.service_preferences`: no FK (arrays
can't reference a table), so **every write path must validate each id against a live,
`is_active`-filtered `practice_areas` query before insert/update** — there is no CASCADE/RESTRICT
safety net. Unlike the write path, *reading* an article's practice areas back deliberately does
**not** filter by `is_active` — an already-published article should keep showing the real name of
a practice area even if it's since been deactivated.

### Design decisions — divergences from the static prototype

These are deliberate product decisions made explicitly with the person who commissioned this
feature, not derived from (and in one case directly contradicting) what the static HTML shows:

- **Reading a single article's full body requires being signed in** (any of the 3 roles) — checked
  `article.html`'s JS directly and confirmed it actually renders full content unconditionally,
  regardless of session state, in the prototype. The real backend gates `GET /v1/articles/:id`
  behind auth anyway; the browse grid (`GET /v1/articles`, list-only, no body) stays public,
  matching the prototype.
- **No editorial review queue.** The prototype models `pending`/`rejected` states with an admin
  moderation table; this session intentionally ships plain ownership-scoped CRUD instead
  (`draft`/`published` only, no queue) — same kind of explicit deferral as membership applications'
  admin-review endpoint (see above).
- **Body content, `country`, and `state` are actually persisted.** The prototype's own
  member-submission flow silently drops all three after the preview screen (a bug in the static
  build, not a design choice) — confirmed by reading its `pendingSubmission` object shape directly.
- **Mutations are keyed by the article's UUID**, not array index (the prototype mutates
  `expertly_my_submissions` by raw array position).
- **`author_id` is a real FK, checked against the authenticated session on every read/write.** The
  prototype hardcodes "current user" to the first seed member for its "My Articles" view — there is
  no real ownership check anywhere in the static build to derive one from.

### Not built yet (explicitly deferred)

- Admin moderation/review queue (`pending`/`rejected` states, approve/reject actions) — see above.
- Tags — suggested in the write-flow UI, never actually persisted in the prototype.
- AI-generated summary bullet points — a static per-category lookup table in the prototype, not
  real per-article data.
- View/like/comment counters — anonymous, `localStorage`-based in the prototype, unrelated to any
  account; a plausible separate future feature, not part of this CRUD-with-ownership contract.
- Category/country query-param filtering on `GET /v1/articles` (the prototype filters client-side
  over the full published set).

## ⚠️ Live database vs. `0001_initial_schema.sql` — a pre-existing drift, not this session's doing

Confirmed directly against the project's real Supabase instance (`psql "$DATABASE_URL"`) while
building the section below: **the live database does not match the `0001_initial_schema.sql` file
currently checked into git.** Live has exactly three tables — `profiles`, `practice_areas`,
`membership_applications` — matching an *older* shape than what's in git (`profiles` is missing
`auth_provider`/`timezone`/`consent`/`deletion_reason`; there is no `articles`, `events`,
`consultation_requests`, or `peer_connect_*` table at all; the practice-area taxonomy is a single
`practice_areas` table, not the git file's `services`/`categories` pair). The git file was
rewritten ("squashed... the DB is rebuilt from scratch from this one file") to a new target shape
that was, as far as this session could determine, never actually applied to this live instance.

**This means the `articles` backend module (and the `authorId` filter documented in
`docs/rest-api.md`) cannot currently be exercised against real data** — the table it queries
doesn't exist live. Not something this session fixes (it's a database-ownership decision, not a
schema-derivation one — whether to reset this instance and apply `0001` fresh, or write incremental
migrations forward from what's actually live and treat the checked-in `0001` as stale) — flagging it
here since it blocks trusting `0001_initial_schema.sql` as ground truth going forward.

**Consequence for this section:** the migration below (`0002_member_directory_and_profiles.sql`) is
written against what's actually live — it references `public.practice_areas`, not `services`.

## Member directory & profiles (`supabase/migrations/0002_member_directory_and_profiles.sql`)

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

Extends `profiles` 1:1 for `role='member'` — `id` **is** the profile id, not a separate owned
resource with its own `owner_user_id` (unlike `articles.author_id`, where the article's own id and
its author's id are genuinely different things).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK, FK → `profiles.id` | |
| `headline`, `bio` | text | |
| `firm_name` | text, nullable | **Null, not the prototype's literal `'Independent'` string** — render that label at the UI layer. Baking display text into data was a deliberate thing *not* to reproduce. |
| `firm_website` | text, nullable | |
| `years_of_experience` | smallint, check 0–60 | drives tier, same shape as the application's own field |
| `rate_min_cents`, `rate_max_cents` | int, check `max > min` | **Named to match `membership_applications.rate_min_cents`/`rate_max_cents`** — same concept, not `fee_range_*` as an earlier draft of this section had it |
| `rate_currency` | text, default `'USD'` | ISO 4217 code — the prototype only ever shows `'$'`, not a real currency code; every seed profile is USD, stored properly so a future non-USD member doesn't need a schema change |
| `member_tier` | enum `membership_tier` (shared with applications) | admin-overridable at approval |
| `is_available` | bool, default `true` | |
| `availability_notes` | text, nullable | |
| `contact_email`, `contact_phone`, `linkedin_url`, `website` | nullable | editable via the `contact` self-edit section |
| `is_verified` | bool, default `false` | the overall "Expertly Verified" badge — distinct from the per-item `is_verified` flags on credentials/testimonials |
| `photo_url` | text, nullable | |
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

**Renewal is deliberately minimal** — just `membership_started_at` + `renewal_payment_status` here,
plus one sitewide `member_renewal_policy` row (below). Due-state (`active`/`due-soon`/`overdue`) is
always computed (`due_date = membership_started_at + period_months`; `overdue` past due, `due-soon`
within `reminder_days` of it), never persisted — nothing to keep in sync. **Confirmed real policy
values, not prototype placeholders left unconfirmed:** 12 months validity, 30-day due-soon window.

### `member_services`

Real join table to `practice_areas` (not JSONB like `service_preferences`/`practice_area_ids`
elsewhere in this schema) — the directory's own search filters by practice area, a need those
write-once/read-as-a-whole tables don't have. Composite PK `(member_id, practice_area_id)`, real FK
(this table *can* have one, unlike the JSONB-array columns, since it's a real join table).

### 8 child tables

All real tables with stable `uuid` ids and a `member_id` FK — unlike `membership_applications`'
JSONB-array fields, these are individually editable via the self-edit moderation flow below and (for
`member_credentials`/`member_testimonials`) carry a per-item verification flag, so JSONB's
"write-once snapshot" justification doesn't apply here.

| Table | Columns | Notes |
|---|---|---|
| `member_work_experiences` | `title`, `company`, `start_year`, `end_year`, `is_current`, `description` | |
| `member_educations` | `degree`, `institution`, `field`, `end_year` | |
| `member_engagements` | `title`, `organization`, `year`, `url` | |
| `member_qualifications` | `name`, `year` | **confirmed distinct from `member_credentials`** — no issuing body, no verification flag |
| `member_credentials` | `name`, `issuing_body`, `year`, `is_verified` | per-item, admin-verifiable |
| `member_testimonials` | `quote`, `client_name`, `client_title`, `client_company`, `service_name`, `occurred_on` (date), `is_verified` | `occurred_on` is a real `date`, not the prototype's free-text `"March 2026"` — format at render time. No `rating`/star field — confirmed absent from every seeded testimonial; don't confuse with the unrelated Peer Connect post-meeting rating. |
| `member_awards` | `title`, `issuing_body`, `year`, `description` | |
| `member_key_clients` | `name`, `logo_url` | reconciles the two logo sources noted above into one column |

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
| `reviewed_by` | FK → `profiles.id`, nullable | |
| `reviewed_at` | timestamptz, nullable | |
| `submitted_at`, `created_at`, `updated_at` | timestamptz | |

**Proof requirement varies by section — confirmed from the actual save logic, not assumed:**
`headline_bio`/`contact` need no proof at all; `education`/`work_experiences` need one shared proof
for the whole batch submission (the `proof_file_url`/`proof_link` columns above); `engagements`/
`testimonials`/`awards`/`key_clients` need proof (or, for `key_clients`, a logo asset) per item,
embedded directly inside each element of the `payload` array — which is why `payload` stays `jsonb`
rather than becoming more structured columns.

On approval, `payload` becomes the live value for that member+section: for the array-shaped
sections, the corresponding child table rows for that member are fully replaced; for
`headline_bio`/`contact`, the matching `member_profiles` columns are overwritten directly. This is
a deliberate whole-section-request workflow (the admin UI approves/rejects one edit request at a
time, not per item) — keep it as-is, it's not a prototype shortcut.

**A real shortcut, flagged rather than reproduced:** the prototype's self-edit UI collapses every
array item down to one free-text line on save (`parseRowText`, `member-profile.html:2345-2355` —
literally `{ description: text }` for everything except testimonials/awards), losing the structured
fields on edit. The backend contract here accepts the same structured payload the base data already
uses — a future frontend session should build a real structured edit UI, not carry the flattened
one forward.

### `member_renewal_policy`

One sitewide settings row (`id` fixed at `1`) — `period_months` (12), `reminder_days` (30). Not
per-member, not versioned, not exposed to any public/owner-scoped endpoint (locked down by RLS,
only the service-role backend touches it) — matches how consultations/renewal read logic computes
due-state from this plus each member's own `membership_started_at`.

### Design decisions — divergences from the static prototype

- **Full profile detail requires sign-in** (`GET /v1/members/:id`) even though the directory list
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
  (`proof_file_url`, per-item `proofFile`-shaped fields inside `payload`, `member_key_clients.
  logo_url`), but the signed-upload-URL endpoint and the Storage bucket configuration are the
  `apps/backend/src/members/` module's job, not the migration's — see `docs/rest-api.md`.
- The admin approve/reject write path for `member_profile_edits` (replace-child-rows-on-approval
  logic) — schema is ready; confirm against `docs/rest-api.md` whether the endpoint landed in the
  same session.
- Promoting an approved `membership_applications` row into a real `member_profiles` row (flips
  `profiles.role` to `member`) — still blocked on the applications-side admin-review endpoint,
  itself still deferred (see that section above).
