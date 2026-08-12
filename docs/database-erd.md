# Expertly — Database ERD

Derived per-feature from `design/static_html/`, per `CLAUDE.md`'s "fixed contract, derived once"
convention — not a speculative upfront spec. Grows as each feature's backend session lands.

## Identity & Auth

See `supabase/migrations/0001_profiles_and_auth.sql` and [`docs/auth.md`](auth.md) — `profiles`
table, `role` enum (`client`/`member`/`admin`), Supabase Auth integration.

**Bug fix, `supabase/migrations/0004_fix_oauth_name_backfill.sql`**: `handle_new_user()` only read
`raw_user_meta_data`'s `first_name`/`last_name` keys — correct for our own `signUp()` call, but
LinkedIn OAuth users never have those keys; Supabase's LinkedIn OIDC integration populates
`given_name`/`family_name` instead (the real OIDC claim names). Every actual LinkedIn signup got
silently empty name fields. Only discovered once a real LinkedIn-signed-up user existed to check
against when applying these migrations to a live project — the original migration's own testing
only used hand-crafted metadata containing `first_name`/`last_name`, which never exercised this
path. Fixed to `coalesce()` both key pairs; verified against both shapes (plus a bare `{}` case)
before being applied to the real project, where the one pre-existing affected user was also
backfilled.

## Membership applications (`supabase/migrations/0002_membership_applications.sql`)

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

`id`, `name` (unique), `is_active`, `category` (added in
`supabase/migrations/0003_practice_area_categories.sql`). Seeded with the 12 real practice areas
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

## Target `member_profiles` shape (design reference only — not migrated yet)

Derived from `design/static_html/member-profile.html` for shared understanding of where
application data flows on approval — this is **not built**, belongs to a separate future "Member
Directory & Profiles" backend session, not this one.

`member_profiles` (extends `profiles` for `role='member'`): `headline`, `bio`, `firm_name`,
`firm_website`, `years_of_experience`, `fee_range_min/max_cents`, `member_tier` (same enum,
admin-overridable at approval), `is_available`, `availability_notes`, `contact_email`,
`contact_phone`, `linkedin_url`, `website`, `is_verified`, `photo_url`.

Plus **7 child tables**, all empty at conversion time and filled in later by the member themselves
via self-edit (this is the concrete mechanism behind "application captures baseline fields, member
adds richer info after"): `member_work_experiences` (mirrors the application version but adds a
`description` field the application never collects), `member_educations`, `member_engagements`,
`member_qualifications`, `member_credentials`, `member_testimonials`, `member_awards`, plus
`member_services` (which practice area(s) they're approved for, distinct from the application's
*preferences*).
