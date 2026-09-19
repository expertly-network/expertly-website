# Design: Category → Service taxonomy (replaces `practice_areas`)

Date: 2026-09-19
Status: pending user review

## 1. Motivation

The client supplied a real, two-level service taxonomy (17 categories, 136 services) covering
tax, legal, accounting, audit, and corporate-compliance service lines. This replaces the site's
current flat `practice_areas` table (12 areas tagged with a 3-value `category` enum:
`taxation`/`legal`/`finance_advisory`).

This is an explicit reversal of a prior decision: `supabase/migrations/0004_tables.sql`'s header
comment says a `categories`+`services` split was drafted once and rejected because it was never
applied anywhere. It was never applied because the real taxonomy didn't exist yet. It exists now,
so the split is being (re)adopted for real, and that rejection note is removed.

No production data exists yet (pre-production), so this is a **clean replace**, not a migration
with backfill: `practice_areas` and `practice_area_category` are dropped outright and every
consumer is repointed at the new tables in the same pass.

## 2. Data model

Two new tables replace `practice_areas`; the `practice_area_category` enum is dropped entirely
(categories are now real rows, not a fixed 3-value enum).

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order smallint not null,
  image_url text,        -- same decorative/nullable role as practice_areas.image_url had
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  sort_order smallint not null,
  -- true for the one "<<Custom Field>>" placeholder row a category may have — selecting it in
  -- the UI reveals a free-text input instead of picking a fixed name. Not every category has one.
  is_custom boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create index services_category_id_idx on public.services (category_id);
```

Both get a `select-all` RLS policy (`using (true)`), matching `practice_areas` today — admin
writes go through the backend's service-role client, which bypasses RLS, so no write policies
are needed, same as every other admin-managed table in this schema.

### Custom-label storage on consuming tables

`is_custom` services carry no fixed meaning by themselves; whoever picks one must also supply
free text. That text is stored as a nullable sidecar next to wherever a service reference already
lives, following each table's existing pattern rather than introducing a new join-table shape:

| Table | Existing service reference | Change |
|---|---|---|
| `member_services` | `practice_area_id uuid` (real FK, composite PK with `member_id`) | Rename column to `service_id`. Add nullable `custom_label text`. |
| `articles` | `practice_area_ids uuid[]` (no FK, live-validated on write) | Rename column to `service_ids`. Add `custom_service_labels jsonb not null default '{}'` — `{ [serviceId]: label }`, only populated for ids that are `is_custom` services. |
| `membership_applications.service_preferences` | JSONB `[{ practiceAreaId, priority }]` | Element shape becomes `{ serviceId, priority, customLabel? }`. |
| `consultation_requests` | `practice_area_id uuid` (nullable FK, schema-only — no API/UI built yet) | Rename column to `service_id`. Add nullable `custom_service_label text`. |

This keeps every table's existing design rationale (documented in `0004_tables.sql`'s comments)
intact — only the referenced table and column names change, not the array-vs-jsonb-vs-join-table
trade-offs already made for each.

### Renumbering & data corrections

The client's numbering (1, 2, 3, 5, 6, …, 18) skips 4 — treated as a drafting gap, not a real
category. Categories are seeded in the client's given order with `sort_order` 1–17 (no gap).
"Gfit, Estate, Wealth & succession planning" is corrected to "Gift, Estate, Wealth & succession
planning" (typo). Service names are unique per-category (`unique(category_id, name)`), not
globally — several names (e.g. "Tax policy and process documentation.", "Startups & Emerging
Companies") intentionally repeat across categories in the source list, since the same service can
be relevant under more than one category.

Only 6 of the 17 categories have an explicit "<<Custom Field>>" row in the source list (Direct
Tax, Indirect Tax, Other taxes, Corporate compliances & Secretarial assistance, Audit & Assurance,
Others). The other 11 don't get one — no custom/free-text option is added where the source didn't
ask for one. "Others" (category 18) is exactly one row: the custom placeholder, no fixed services.

Full seed list (136 service rows across 17 categories) is transcribed in the implementation plan,
not duplicated here — the table above defines the shape, the plan carries the literal data.

No images are seeded for the new categories (the old 12 practice areas had per-name Unsplash
placeholder URLs from the design prototype; these 17 don't have prototype equivalents to source
images from). `image_url` stays null until an admin sets one via the new CRUD UI.

## 3. Backend

Two new modules replace `apps/backend/src/practice-areas/`, matching the existing one-module-per-
resource convention (`articles/`, `events/`, `applications/`):

- **`categories/`** — `CategoriesController` (public `GET /v1/categories` → nested
  `CategoryDto[]` with `services: ServiceDto[]` embedded, `is_active`-filtered, matching how
  `GET /v1/practice-areas` was the one call every consumer used), `CategoriesAdminController`
  (🛡️ `POST /v1/admin/categories`, `PATCH /v1/admin/categories/:id`, `DELETE
  /v1/admin/categories/:id` — delete only permitted when the category has zero services, else
  `409 CATEGORY_HAS_SERVICES`), service, repository.
- **`services/`** — `ServicesAdminController` (🛡️ `POST
  /v1/admin/categories/:categoryId/services`, `PATCH /v1/admin/services/:id`, `DELETE
  /v1/admin/services/:id` — delete blocked with `409 SERVICE_IN_USE` if referenced by any
  `member_services`/`articles.service_ids`/`service_preferences`/`consultation_requests` row),
  service, repository.

No dedicated bulk-reorder endpoint — `sortOrder` is a plain editable field on each PATCH, same
granularity as everything else in this pass. Drag-and-drop reordering can be layered on later if
admin actually needs it; not building it speculatively now.

Every module that currently live-validates against `practice_areas` (`articles/`, `applications/`,
`members/`) is repointed at `services` (validating `serviceId`s against active, non-deleted
services; when `isCustom` is true on the referenced service, the corresponding `customLabel`/
`customServiceLabel` field becomes required on write).

## 4. REST API contract (`docs/rest-api.md` changes)

- `GET /v1/practice-areas` → removed.
- `GET /v1/categories` → `CategoryDto[]`: `{ id, name, sortOrder, imageUrl: string|null, services: ServiceDto[] }`. `ServiceDto`: `{ id, categoryId, name, sortOrder, isCustom }`.
- New admin CRUD endpoints per §3.
- `membership_applications` service-preferences shape: `servicePreferences[].practiceAreaId` → `.serviceId`, `.customLabel?` added.
- `articles`: `practiceAreaIds` → `serviceIds`; new optional `customServiceLabels?: Record<string, string>`.
- Member directory filter: `GET /v1/members?practiceAreaId=` → `?categoryId=&serviceId=` (both optional; `categoryId` alone broadens to "any service in this category", matching the two-level pill+dropdown UI this enables).
- `member.services` (wherever a member's services are returned) now returns `ServiceDto[]` extended with `categoryId`/`categoryName` so a directory card can show which category a service belongs to without a second lookup.

## 5. `packages/shared-types/`

`practice-area.ts` (`PracticeAreaDto`, `PracticeAreaCategory`) is deleted. New
`category.ts`/`service.ts` export `CategoryDto`, `ServiceDto`, and the admin create/update DTOs.
Every `import type { PracticeAreaDto, ... }` across the frontend is repointed.

## 6. Frontend

All existing practice-area surfaces are repointed at the new two-level model (client already
confirmed: "everywhere we have service and category"):

| File | Change |
|---|---|
| `lib/api/practice-areas.ts` | Renamed/replaced with `lib/api/categories.ts` (`getCategories()` → nested tree). |
| `components/home/PracticeAreasMarquee.tsx` | Renders category names/images (was practice-area names); links to `/members?categoryId=`. |
| `components/members/DirectoryFilterBar.tsx` | Two-level filter: category pills, then a service sub-filter within the selected category. |
| `components/apply/ApplicationWizard.tsx`, `steps/ServicesRatesStep.tsx`, `steps/ReviewSubmitStep.tsx` | Category-pill-filtered service picker already exists as a UI pattern (mirrors `design/static_html/assets/onboarding-form.js`'s `SERVICE_TAXONOMY`) — repointed at real `categoryId`/`serviceId`s instead of the flat list; custom-field category shows a text input when the placeholder service is picked. |
| `components/articles/ManualArticleForm.tsx`, `WriteArticleFlow.tsx`, `AiDraftWizard.tsx` | Multi-select tagging becomes category-grouped service selection; custom entries captured per the `customServiceLabels` map. |
| `components/articles/ArticlesGrid.tsx`, `ArticlesTabsSection.tsx`, `RelatedArticles.tsx` | Filter/matching logic keys off `serviceIds` instead of `practiceAreaIds`. |
| `components/articles/ArticleAuthorSidebar.tsx` | Shows author's primary service + its category. |
| `components/admin/AdminArticlesTable.tsx` | Column joins service (+ category) names. |
| `lib/cover-images.ts` | Re-keyed by **category** name (17 buckets) instead of the old 12 practice-area names — one cover image per category, not per service (136 images is impractical and wasn't asked for). |
| New: admin taxonomy management page | Not present today (practice areas had no admin CRUD at all). New page under the admin dashboard: list categories (expandable to services), create/edit/deactivate/delete both levels, per §3's endpoints. Needs its own `design/static_html/admin-dashboard.html` check for closest existing admin-table pattern to follow, since no prototype page covers this. |

Consultation booking is **not** wired in — no booking UI exists yet (`consultation_requests` is
schema-only, per the build order in `CLAUDE.md`: consultations hasn't been built as a feature).
The `consultation_requests.service_id` rename (§2) keeps that table consistent with the new model
so the eventual consultations feature is built against it directly, without another migration.

## 7. Out of scope / deferred

- Bulk drag-and-drop reordering endpoint (plain `sortOrder` field edit is enough for now).
- Per-service images (only categories get one).
- Consultation booking UI/API (feature doesn't exist yet; schema column renamed for forward-compat only).
- Any backfill/compat shim for existing `practice_areas` data (pre-production, no real rows to preserve).

## 8. Delivery order

Per `CLAUDE.md`'s backend-contract-is-fixed rule: §2–5 (schema, backend modules, REST contract,
shared-types) are built and verified (curl/REST client, no frontend needed) as a complete phase
first. §6 (frontend) starts only once that contract is in place and not touched again mid-frontend
-work — this is enforced as phase order within one implementation plan, not literally two separate
chat sessions, since the full contract is already fixed by this spec rather than discovered
iteratively.

## 9. Files touched (summary)

- `supabase/migrations/0002_enums.sql` — drop `practice_area_category`.
- `supabase/migrations/0004_tables.sql` — drop `practice_areas`; add `categories`, `services`;
  rename/add columns on `member_services`, `articles`, `membership_applications`,
  `consultation_requests`; full seed data insert.
- `docs/database-erd.md`, `docs/rest-api.md` — replace the practice-areas sections.
- `packages/shared-types/practice-area.ts` → deleted; add `category.ts`, `service.ts`.
- `apps/backend/src/practice-areas/` → deleted; add `apps/backend/src/categories/`,
  `apps/backend/src/services/`; update `articles/`, `applications/`, `members/`,
  `consultation-requests/` (if present) validation/repository code.
- `apps/frontend/` — every file listed in §6, plus a new admin taxonomy page.
