# Category → Service Taxonomy — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `practice_areas` table with a real two-level `categories`→`services`
taxonomy (17 categories, 138 services) and repoint every backend module that currently references
`practice_areas`/`practice_area_id`/`practice_area_ids` at it, including new admin CRUD for the
taxonomy itself.

**Architecture:** Two new Postgres tables (`categories`, `services`, FK'd) replace `practice_areas`
and its `practice_area_category` enum. Two new NestJS modules (`categories/`, `services/`) own the
public read + admin CRUD. `articles/`, `applications/`, `members/` — the three existing modules
that referenced the old table — get repointed to the new one, including custom-label sidecar
columns for the taxonomy's `<<Custom Field>>` entries. Frontend is **out of scope** for this plan —
a separate plan follows once this contract is live, per `CLAUDE.md`'s backend-first rule.

**Tech Stack:** NestJS (Fastify), Supabase/Postgres (service-role client), `class-validator` DTOs,
`@nestjs/swagger` decorators on shared-types classes consumed via `import type`.

**Spec:** `docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md`

## Global Constraints

- TypeScript strict, no `any` (repositories cast through `unknown` at the Supabase call site only,
  matching every existing repository in this codebase).
- Repository is the only Supabase consumer per module; every table gets its own private accessor
  method; never `select('*')`; every query names its columns via a `COLUMNS` const + hand-written
  row interface.
- `src/supabase/database.types.ts` is generated, never hand-edited; regenerate after every schema
  change (`pnpm gen:types`, needs `SUPABASE_DB_URL`).
- Every route has an explicit `@Public()` / no-decorator / `@Roles()` / `@RequiresPermission()`
  posture, commented with a 🌐/🔒/🔑/🛡️ marker.
- Array/JSONB columns that reference another table by id with no real FK (`articles.service_ids`,
  `membership_applications.service_preferences`) must have every id validated against a live query
  before insert/update — no CASCADE/RESTRICT safety net on those.
- No production data exists yet — schema changes are applied directly (drop/rename), no backfill.
- `packages/shared-types/*.ts` files export classes decorated with `@ApiProperty`/`@ApiPropertyOptional`
  (for Swagger), always consumed via `import type` on both sides — never a plain `import`.

## Note on task sizing

Tasks 1 and 2 (pure SQL) are independently testable via `psql` and safe to commit alone. Task 3 is
deliberately one large task, not several small ones: NestJS's `nest build` type-checks the entire
backend program at once, and `database.types.ts` regeneration (which Task 3 starts with) makes
every repository still referencing `practice_areas`/`practice_area_id` a **compile error** the
moment it lands — so there is no way to split "add categories/services module" from "repoint
articles/applications/members" into separately-green-compiling commits. Task 3's steps are still
bite-sized; its verification and commit are just at the end, not per sub-part.

---

## Task 1: Migration — create `categories` and `services` tables + seed data (additive)

**Files:**
- Modify: `supabase/migrations/0004_tables.sql`

**Interfaces:**
- Produces: tables `public.categories(id, name, sort_order, image_url, is_active, created_at, updated_at)`
  and `public.services(id, category_id, name, sort_order, is_custom, is_active, created_at, updated_at)`,
  seeded with 17 rows / 138 rows respectively. `practice_areas` is untouched — still exists after this task.

- [ ] **Step 1: Edit the file header comment**

In `supabase/migrations/0004_tables.sql`, replace the "don't reintroduce categories/services" note
(currently lines 11–15) with:

```sql
-- Practice-area taxonomy is a real two-level `categories` + `services` split (see the sections
-- below) — a client-supplied taxonomy (17 categories, 138 services) replaced the old flat
-- `practice_areas` table outright; no production data existed to preserve. See
-- docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md for the full rationale.
```

- [ ] **Step 2: Add the `categories` and `services` table definitions**

Insert this new section into `supabase/migrations/0004_tables.sql` immediately **after** the
`practice_areas` section ends (after the seed `insert` statement that currently ends the section,
before the `-- ============... articles` section header):

```sql
-- ============================================================================
-- categories / services — the two-level service taxonomy. `services.category_id` has no ON
-- DELETE clause (default restrict): deleting a category that still has services fails with a
-- foreign-key violation (23503), caught in CategoriesRepository and turned into a 409 — an admin
-- must delete/move a category's services first. Referenced by a real FK from member_services
-- (same restrict-by-default posture) and consultation_requests (on delete set null, since a
-- consultation request shouldn't be blocked from ever deleting a service); referenced by id with
-- no FK from articles.service_ids and membership_applications.service_preferences — same
-- array/JSONB trade-off practice_areas already had, see those sections.
-- ============================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order smallint not null,
  -- Same decorative-only, nullable, not-user-facing-until-admin-sets-it role practice_areas.image_url had.
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy categories_select_all
  on public.categories for select
  using (true);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  name text not null,
  sort_order smallint not null,
  -- One placeholder "Other (please specify)" row per category that has one — selecting it in the
  -- UI reveals a free-text input, stored in a custom-label sidecar column on whichever table
  -- references this service id (see member_services/articles/membership_applications/
  -- consultation_requests below).
  is_custom boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create index services_category_id_idx on public.services (category_id);

alter table public.services enable row level security;

create policy services_select_all
  on public.services for select
  using (true);

-- Seed data: 17 categories, 138 services, transcribed verbatim from the client-supplied taxonomy
-- (docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md §2), except one typo fix
-- ("Gfit" -> "Gift" under Direct Tax) and the numbering gap at #4 closed (categories are keyed by
-- name, not the client's original S.No). sort_order is source order within each category.
insert into public.categories (name, sort_order) values
  ('Direct Tax', 1),
  ('Indirect Tax', 2),
  ('Other taxes', 3),
  ('Corporate compliances & Secretarial assistance', 4),
  ('Accounting & related compliances', 5),
  ('Audit & Assurance', 6),
  ('Legal - Corporate, M&A & Capital Markets', 7),
  ('Legal - Banking, Finance & Insolvency', 8),
  ('Legal - Dispute Resolution & Investigations', 9),
  ('Legal - Regulatory, Competition & Public Law', 10),
  ('Legal - Data Protection, Technology & IP', 11),
  ('Legal - Employment & Immigration', 12),
  ('Legal - Real Estate, Infrastructure & Environment', 13),
  ('Legal - Private Client, Family & Wealth', 14),
  ('Legal - Sector-Specific Practices', 15),
  ('Notarial & Admin Services', 16),
  ('Others', 17);

insert into public.services (category_id, name, sort_order, is_custom)
select c.id, s.name, s.sort_order, s.is_custom
from public.categories c
join (values
  ('Direct Tax', 'Individual & Expat tax', 1, false),
  ('Direct Tax', 'Corporate Income tax / Federal Tax', 2, false),
  ('Direct Tax', 'Partnership & Pass-Through Tax', 3, false),
  ('Direct Tax', 'Fund & Investment Management Tax', 4, false),
  ('Direct Tax', 'State Income Tax / State And Local Tax (SALT)', 5, false),
  ('Direct Tax', 'International / Cross Border tax', 6, false),
  ('Direct Tax', 'M&A / Transaction Tax', 7, false),
  ('Direct Tax', 'Transfer pricing', 8, false),
  ('Direct Tax', 'Income Tax Compliances', 9, false),
  ('Direct Tax', 'Tax Litigation & Dispute Resolutions', 10, false),
  ('Direct Tax', 'Gift, Estate, Wealth & succession planning', 11, false),
  ('Direct Tax', 'Non-profit / Charity Tax', 12, false),
  ('Direct Tax', 'Equity Compensation & Benefits Tax (ESOPs / RSUs / SARs)', 13, false),
  ('Direct Tax', 'Tax policy and process documentation.', 14, false),
  ('Direct Tax', 'Tax control framework and tax-risk review.', 15, false),
  ('Direct Tax', 'Tax due diligence.', 16, false),
  ('Direct Tax', 'ERP and tax-technology implementation.', 17, false),
  ('Direct Tax', 'Tax investigations and forensic support.', 18, false),
  ('Direct Tax', 'Tax data analytics and dashboarding.', 19, false),
  ('Direct Tax', 'Other (please specify)', 20, true),

  ('Indirect Tax', 'Customs advisory', 1, false),
  ('Indirect Tax', 'Customs compliance', 2, false),
  ('Indirect Tax', 'Excise Duty Advisory & Compliance', 3, false),
  ('Indirect Tax', 'GST / VAT / Sales Tax advisory', 4, false),
  ('Indirect Tax', 'GST / VAT / Sales Tax compliances', 5, false),
  ('Indirect Tax', 'GST / VAT/ Sales Tax litigation & dispute resolutions', 6, false),
  ('Indirect Tax', 'GST / VAT/ Sales Tax Refund', 7, false),
  ('Indirect Tax', 'Indirect Tax Incentives', 8, false),
  ('Indirect Tax', 'R&D Tax Credits & Incentives', 9, false),
  ('Indirect Tax', 'Tax Technology & Automation', 10, false),
  ('Indirect Tax', 'Tax policy and process documentation.', 11, false),
  ('Indirect Tax', 'Tax control framework and tax-risk review.', 12, false),
  ('Indirect Tax', 'Tax due diligence.', 13, false),
  ('Indirect Tax', 'ERP and tax-technology implementation.', 14, false),
  ('Indirect Tax', 'Tax investigations and forensic support.', 15, false),
  ('Indirect Tax', 'Tax data analytics and dashboarding.', 16, false),
  ('Indirect Tax', 'Other (please specify)', 17, true),

  ('Other taxes', 'Property tax', 1, false),
  ('Other taxes', 'Stamp Duty advisory & compliances', 2, false),
  ('Other taxes', 'Other (please specify)', 3, true),

  ('Corporate compliances & Secretarial assistance', 'Banking & KYC Setup', 1, false),
  ('Corporate compliances & Secretarial assistance', 'Beneficial Ownership (UBO) & KYC Filings', 2, false),
  ('Corporate compliances & Secretarial assistance', 'Corporate Governance/ ESG Advisory', 3, false),
  ('Corporate compliances & Secretarial assistance', 'Entity Formation & Setup', 4, false),
  ('Corporate compliances & Secretarial assistance', 'Exchange control laws', 5, false),
  ('Corporate compliances & Secretarial assistance', 'Secretarial compliances', 6, false),
  ('Corporate compliances & Secretarial assistance', 'Statutory mergers / amalgamations', 7, false),
  ('Corporate compliances & Secretarial assistance', 'Stock exchange regulations', 8, false),
  ('Corporate compliances & Secretarial assistance', 'Other (please specify)', 9, true),

  ('Accounting & related compliances', 'Book keeping services', 1, false),
  ('Accounting & related compliances', 'CFO Services', 2, false),
  ('Accounting & related compliances', 'Payroll compliances', 3, false),
  ('Accounting & related compliances', 'Strategic business planning & financial consulting', 4, false),
  ('Accounting & related compliances', 'Preparation of sustainability, CSR, ESG integrated reports', 5, false),
  ('Accounting & related compliances', 'Financial forecasting, capital allocation, investment analysis', 6, false),
  ('Accounting & related compliances', 'Accounting advisory', 7, false),
  ('Accounting & related compliances', 'Financial Statement Preparation & Compilation', 8, false),
  ('Accounting & related compliances', 'Management Reporting / MIS', 9, false),
  ('Accounting & related compliances', 'Fixed Asset & Depreciation Accounting', 10, false),
  ('Accounting & related compliances', 'Multi-GAAP Conversion (US GAAP / IFRS / Ind AS)', 11, false),
  ('Accounting & related compliances', 'Consolidation Accounting', 12, false),
  ('Accounting & related compliances', 'Treasury & Cash Flow Management', 13, false),
  ('Accounting & related compliances', 'Accounts Receivable / Payable Management', 14, false),
  ('Accounting & related compliances', 'Accounting Systems & ERP Implementation Support', 15, false),

  ('Audit & Assurance', 'Statutory audit', 1, false),
  ('Audit & Assurance', 'Internal audit/ risk management', 2, false),
  ('Audit & Assurance', 'System audit', 3, false),
  ('Audit & Assurance', 'Due diligence', 4, false),
  ('Audit & Assurance', 'Valuation services', 5, false),
  ('Audit & Assurance', 'Forensic audit/ investigation', 6, false),
  ('Audit & Assurance', 'ESG/sustainability assurance', 7, false),
  ('Audit & Assurance', 'SOC (System and Organization Controls) reporting', 8, false),
  ('Audit & Assurance', 'Tax Audit', 9, false),
  ('Audit & Assurance', 'Internal Financial Controls (IFC) / SOX Compliance Audit', 10, false),
  ('Audit & Assurance', 'Special Purpose Audit / Agreed-Upon Procedures', 11, false),
  ('Audit & Assurance', 'Regulatory Compliance Audit', 12, false),
  ('Audit & Assurance', 'Group / Component Audit', 13, false),
  ('Audit & Assurance', 'Other (please specify)', 14, true),

  ('Legal - Corporate, M&A & Capital Markets', 'Capital Markets', 1, false),
  ('Legal - Corporate, M&A & Capital Markets', 'Contractual Laws', 2, false),
  ('Legal - Corporate, M&A & Capital Markets', 'Corporate Laws', 3, false),
  ('Legal - Corporate, M&A & Capital Markets', 'Mergers & Acquisitions', 4, false),
  ('Legal - Corporate, M&A & Capital Markets', 'Private Equity', 5, false),
  ('Legal - Corporate, M&A & Capital Markets', 'Startups & Emerging Companies', 6, false),
  ('Legal - Corporate, M&A & Capital Markets', 'Venture Capital', 7, false),

  ('Legal - Banking, Finance & Insolvency', 'Banking & Finance', 1, false),
  ('Legal - Banking, Finance & Insolvency', 'Bankruptcy/Restructuring', 2, false),
  ('Legal - Banking, Finance & Insolvency', 'Fintech & Payments Regulation', 3, false),
  ('Legal - Banking, Finance & Insolvency', 'Insolvency and bankruptcy', 4, false),
  ('Legal - Banking, Finance & Insolvency', 'Private Banks', 5, false),
  ('Legal - Banking, Finance & Insolvency', 'Restructuring/Insolvency', 6, false),
  ('Legal - Banking, Finance & Insolvency', 'Structured Finance & Securitization', 7, false),

  ('Legal - Dispute Resolution & Investigations', 'Alternative Dispute Resolution', 1, false),
  ('Legal - Dispute Resolution & Investigations', 'Class Actions / Group Litigation', 2, false),
  ('Legal - Dispute Resolution & Investigations', 'International Arbitration', 3, false),
  ('Legal - Dispute Resolution & Investigations', 'Litigation: General Commercial', 4, false),
  ('Legal - Dispute Resolution & Investigations', 'Product Liability & Mass Torts', 5, false),
  ('Legal - Dispute Resolution & Investigations', 'White-Collar Crime & Corporate Investigations', 6, false),

  ('Legal - Regulatory, Competition & Public Law', 'Anti-Bribery & Corruption Compliance', 1, false),
  ('Legal - Regulatory, Competition & Public Law', 'Antitrust', 2, false),
  ('Legal - Regulatory, Competition & Public Law', 'Competition Law', 3, false),
  ('Legal - Regulatory, Competition & Public Law', 'Exchange control regulations/ Foreign investments', 4, false),
  ('Legal - Regulatory, Competition & Public Law', 'Government & Public Policy / Administrative Law', 5, false),
  ('Legal - Regulatory, Competition & Public Law', 'Public Finance', 6, false),
  ('Legal - Regulatory, Competition & Public Law', 'Sanctions & Export Controls', 7, false),

  ('Legal - Data Protection, Technology & IP', 'Artificial Intelligence', 1, false),
  ('Legal - Data Protection, Technology & IP', 'Cybersecurity Law', 2, false),
  ('Legal - Data Protection, Technology & IP', 'Data Protection & IT Laws', 3, false),
  ('Legal - Data Protection, Technology & IP', 'Intellectual property (IP) Laws', 4, false),
  ('Legal - Data Protection, Technology & IP', 'Patents & Trademark Prosecution', 5, false),
  ('Legal - Data Protection, Technology & IP', 'Privacy & Data Security: Privacy', 6, false),
  ('Legal - Data Protection, Technology & IP', 'Technology, Media, and Telecommunications', 7, false),

  ('Legal - Employment & Immigration', 'Employment / Labour laws / Social Security', 1, false),
  ('Legal - Employment & Immigration', 'Immigration', 2, false),

  ('Legal - Real Estate, Infrastructure & Environment', 'Energy & Natural Resources', 1, false),
  ('Legal - Real Estate, Infrastructure & Environment', 'Environmental / ESG compliance', 2, false),
  ('Legal - Real Estate, Infrastructure & Environment', 'Projects, Infrastructure & Energy', 3, false),
  ('Legal - Real Estate, Infrastructure & Environment', 'Real Estate - Property registration & compliances', 4, false),
  ('Legal - Real Estate, Infrastructure & Environment', 'Real Estate Advisory & Structuring', 5, false),
  ('Legal - Real Estate, Infrastructure & Environment', 'Real Estate Litigation', 6, false),

  ('Legal - Private Client, Family & Wealth', 'Civil Laws', 1, false),
  ('Legal - Private Client, Family & Wealth', 'Family Laws', 2, false),
  ('Legal - Private Client, Family & Wealth', 'Inheritance Law & Succession Planning', 3, false),
  ('Legal - Private Client, Family & Wealth', 'Private Wealth Law', 4, false),
  ('Legal - Private Client, Family & Wealth', 'Trusts & Estate Litigation', 5, false),
  ('Legal - Private Client, Family & Wealth', 'Wealth Managers', 6, false),

  ('Legal - Sector-Specific Practices', 'Aviation', 1, false),
  ('Legal - Sector-Specific Practices', 'Healthcare', 2, false),
  ('Legal - Sector-Specific Practices', 'Insurance', 3, false),
  ('Legal - Sector-Specific Practices', 'Life Sciences', 4, false),
  ('Legal - Sector-Specific Practices', 'Maritime/Admiralty', 5, false),
  ('Legal - Sector-Specific Practices', 'Notary', 6, false),
  ('Legal - Sector-Specific Practices', 'Private Aircraft', 7, false),
  ('Legal - Sector-Specific Practices', 'Startups & Emerging Companies', 8, false),
  ('Legal - Sector-Specific Practices', 'Transportation: Road (Carriage/Logistics)', 9, false),

  ('Notarial & Admin Services', 'Document Legalization & Apostille', 1, false),
  ('Notarial & Admin Services', 'Regulatory Filings & Licensing (legal support)', 2, false),

  ('Others', 'Other (please specify)', 1, true)
) as s(category_name, name, sort_order, is_custom) on s.category_name = c.name;
```

- [ ] **Step 2b: Correct the spec's total-service count**

The design spec (§1/§2) says "136 service rows" — the actual transcribed count above is **138**
(the spec's summary line was a miscount during transcription, not a data difference). Edit
`docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md`, replacing every
occurrence of "136" with "138".

- [ ] **Step 3: Apply the additive delta to the dev database**

Run (reads `DATABASE_URL` from `apps/backend/.env` without printing it; the SQL is exactly Step
2's `create table`/`insert` statements, nothing from Step 1 since that's a comment-only change):

```bash
cd /Users/shreyans/Personal/Projects/expertly-website
set -a; source apps/backend/.env; set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /dev/stdin <<'SQL'
-- (paste the exact create table / create policy / insert statements from Step 2 here)
SQL
```

- [ ] **Step 4: Verify against the live database**

```bash
psql "$DATABASE_URL" -c "select count(*) from public.categories;"
psql "$DATABASE_URL" -c "select count(*) from public.services;"
psql "$DATABASE_URL" -c "select c.name, count(*) from public.services s join public.categories c on c.id = s.category_id group by c.name order by c.name;"
```

Expected: 17 categories, 138 services total. Per-category counts: Direct Tax 20, Indirect Tax 17,
Other taxes 3, Corporate compliances & Secretarial assistance 9, Accounting & related compliances
15, Audit & Assurance 14, Legal - Corporate, M&A & Capital Markets 7, Legal - Banking, Finance &
Insolvency 7, Legal - Dispute Resolution & Investigations 6, Legal - Regulatory, Competition &
Public Law 7, Legal - Data Protection, Technology & IP 7, Legal - Employment & Immigration 2,
Legal - Real Estate, Infrastructure & Environment 6, Legal - Private Client, Family & Wealth 6,
Legal - Sector-Specific Practices 9, Notarial & Admin Services 2, Others 1.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_tables.sql docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md
git commit -m "$(cat <<'EOF'
feat(backend): add categories/services taxonomy tables + seed data

Additive only — practice_areas stays in place until the cutover task
repoints its consumers.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migration — cutover: drop `practice_areas`/enum, repoint consumer columns

**Files:**
- Modify: `supabase/migrations/0002_enums.sql`
- Modify: `supabase/migrations/0004_tables.sql`

**Interfaces:**
- Consumes: `public.categories`, `public.services` from Task 1.
- Produces: `public.member_services.service_id` (was `practice_area_id`) + `custom_label`;
  `public.articles.service_ids` (was `practice_area_ids`) + `custom_service_labels`;
  `public.consultation_requests.service_id` (was `practice_area_id`) + `custom_service_label`;
  `public.practice_areas` and `public.practice_area_category` no longer exist.

- [ ] **Step 1: Remove the `practice_area_category` enum**

In `supabase/migrations/0002_enums.sql`, delete this block (currently around line 19-21):

```sql
-- ── practice_areas ───────────────────────────────────────────────────────────

create type public.practice_area_category as enum ('taxation', 'legal', 'finance_advisory');
```

- [ ] **Step 2: Remove the `practice_areas` table section from `0004_tables.sql`**

Delete the entire `practice_areas` section (the `-- ====...` header, the `create table
public.practice_areas`, its index, RLS policy, and seed `insert` — everything between the
`-- practice_areas —` header comment and the `-- ====... articles` header that follows it).

- [ ] **Step 3: Update the `member_services` section**

Find:
```sql
create table public.member_services (
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  practice_area_id uuid not null references public.practice_areas (id),
  primary key (member_id, practice_area_id)
);

create index member_services_practice_area_id_idx on public.member_services (practice_area_id);
```

Replace with:
```sql
create table public.member_services (
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  service_id uuid not null references public.services (id),
  -- Set only when the referenced service is_custom — the member's free-text entry.
  custom_label text,
  primary key (member_id, service_id)
);

create index member_services_service_id_idx on public.member_services (service_id);
```

Also update the section's header comment (currently "practice areas a member is
approved/listed for... needs a real FK the jsonb sections don't") to say "services" instead of
"practice areas" throughout.

- [ ] **Step 4: Update the `articles` section**

Find:
```sql
  practice_area_ids uuid[] not null default '{}',
```
(the one on the `articles` table, with its "No FK — arrays can't reference a table..." comment
above it)

Replace with:
```sql
  service_ids uuid[] not null default '{}',
  -- Set only for ids in service_ids that reference an is_custom service: { [serviceId]: label }.
  custom_service_labels jsonb not null default '{}',
```

Update the comment above it and the "Design decisions" prose elsewhere in the file that says
"practice_area_ids"/"practice areas" to say "service_ids"/"services".

- [ ] **Step 5: Update the `consultation_requests` section**

Find:
```sql
  practice_area_id uuid references public.practice_areas (id) on delete set null,
```
and
```sql
create index consultation_requests_practice_area_id_idx on public.consultation_requests (practice_area_id);
```

Replace with:
```sql
  service_id uuid references public.services (id) on delete set null,
  -- Set only when service_id references an is_custom service.
  custom_service_label text,
```
and
```sql
create index consultation_requests_service_id_idx on public.consultation_requests (service_id);
```

- [ ] **Step 6: Update the `membership_applications.service_preferences` doc comment**

Find the comment above `service_preferences jsonb not null default '[]'` (currently: "Services &
rates (step 4). service_preferences: [{ practiceAreaId, priority }, ...]..."). Replace
`practiceAreaId` with `serviceId`, add `, customLabel?` to the shape shown, and replace
`practice_areas` with `services` in the validation-trade-off prose. No SQL change — this column
stays JSONB with no schema-level shape change.

- [ ] **Step 7: Apply the cutover delta to the dev database**

```bash
cd /Users/shreyans/Personal/Projects/expertly-website
set -a; source apps/backend/.env; set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
drop table if exists public.practice_areas cascade;
drop type if exists public.practice_area_category;

alter table public.member_services rename column practice_area_id to service_id;
alter table public.member_services add column custom_label text;
alter table public.member_services add constraint member_services_service_id_fkey
  foreign key (service_id) references public.services (id);
alter index if exists member_services_practice_area_id_idx rename to member_services_service_id_idx;

alter table public.articles rename column practice_area_ids to service_ids;
alter table public.articles add column custom_service_labels jsonb not null default '{}';

alter table public.consultation_requests rename column practice_area_id to service_id;
alter table public.consultation_requests add column custom_service_label text;
alter table public.consultation_requests add constraint consultation_requests_service_id_fkey
  foreign key (service_id) references public.services (id) on delete set null;
alter index if exists consultation_requests_practice_area_id_idx rename to consultation_requests_service_id_idx;
SQL
```

- [ ] **Step 8: Verify against the live database**

```bash
psql "$DATABASE_URL" -c "select to_regclass('public.practice_areas');"          # expect NULL
psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name='member_services' order by ordinal_position;"
psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name='articles' and column_name in ('service_ids','custom_service_labels');"
psql "$DATABASE_URL" -c "select column_name from information_schema.columns where table_name='consultation_requests' and column_name in ('service_id','custom_service_label');"
```

Expected: `practice_areas` regclass is NULL; `member_services` has `member_id, service_id,
custom_label`; `articles` has both new columns; `consultation_requests` has both new columns.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0002_enums.sql supabase/migrations/0004_tables.sql
git commit -m "$(cat <<'EOF'
feat(backend): cut over member_services/articles/consultation_requests to the services taxonomy

Drops practice_areas and its enum now that categories/services (added in
the previous commit) are the real taxonomy. No production data to
preserve — pre-production, clean rename.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Backend code — types, new taxonomy modules, repoint articles/applications/members

This is one task (see "Note on task sizing" above) with several internal parts, ending in one
verification pass and one commit.

**Files:**
- Regenerate: `apps/backend/src/supabase/database.types.ts`
- Create: `packages/shared-types/category.ts`, `packages/shared-types/service.ts`
- Modify: `packages/shared-types/index.ts`, `packages/shared-types/article.ts`,
  `packages/shared-types/membership-application.ts`, `packages/shared-types/member.ts`
- Delete: `packages/shared-types/practice-area.ts`
- Create: `apps/backend/src/categories/{categories.module.ts,categories.controller.ts,admin-categories.controller.ts,categories.service.ts,categories.repository.ts,dto/create-category.dto.ts,dto/update-category.dto.ts}`
- Create: `apps/backend/src/services/{services.module.ts,admin-services.controller.ts,services.service.ts,services.repository.ts,dto/create-service.dto.ts,dto/update-service.dto.ts}`
- Delete: `apps/backend/src/practice-areas/` (entire folder)
- Modify: `apps/backend/src/app.module.ts`, `apps/backend/src/auth/constants/admin-permissions.ts`
- Modify: `apps/backend/src/articles/{articles.repository.ts,articles.service.ts,articles.controller.ts,articles.module.ts,dto/create-article.dto.ts,dto/update-article.dto.ts}`
- Modify: `apps/backend/src/ai/{ai.service.ts,dto/suggest-topics.dto.ts,dto/ai-draft-request.dto.ts}`
- Modify: `apps/backend/src/applications/{applications.repository.ts,applications.service.ts,dto/service-preference.dto.ts}`
- Modify: `apps/backend/src/members/{members.repository.ts,members.service.ts,members.controller.ts}`

**Interfaces:**
- Produces: `GET /v1/categories` (🌐, nested `CategoryDto[]`), `GET/POST/PATCH/DELETE
  /v1/admin/categories[/:id]` (🛡️ `manageTaxonomy`), `POST /v1/admin/categories/:categoryId/services`,
  `PATCH/DELETE /v1/admin/services/:id` (🛡️ `manageTaxonomy`).
- Changes: `CreateArticleRequest.practiceAreaIds`→`.serviceIds` (+`customServiceLabels?`),
  `ArticleDto.practiceAreas`→`.services` (type `ArticleService[]`, now carries `categoryId`/
  `categoryName`), `ServicePreferenceInput.practiceAreaId`→`.serviceId` (+`customLabel?`),
  `ServicePreference.practiceAreaName`→`.serviceName` (+`categoryId`/`categoryName`),
  `MemberDto/MemberListItemDto.practiceAreas`→`.services` (type `MemberService[]`), member
  directory query param `practiceAreaId`→`serviceId` (+ new `categoryId`).

### Part A — Regenerate types

- [ ] **Step A1: Regenerate `database.types.ts`**

```bash
cd /Users/shreyans/Personal/Projects/expertly-website/apps/backend
set -a; source .env; set +a
SUPABASE_DB_URL="$DATABASE_URL" pnpm gen:types
```

- [ ] **Step A2: Confirm the regenerated file is correct (not a full typecheck — see note above)**

```bash
grep -c "practice_areas" apps/backend/src/supabase/database.types.ts   # expect 0
grep -c "categories:" apps/backend/src/supabase/database.types.ts      # expect >= 1
grep -c "services:" apps/backend/src/supabase/database.types.ts       # expect >= 1
```

At this point `pnpm --filter ./apps/backend typecheck` is **expected to fail** — every remaining
step in this task fixes one more piece of that until Part F's verification.

### Part B — shared-types: `category.ts` / `service.ts`

- [ ] **Step B1: Create `packages/shared-types/service.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isCustom!: boolean;
  @ApiProperty() isActive!: boolean;
}

export class CreateServiceRequest {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() isCustom?: boolean;
}

export type UpdateServiceRequest = Partial<CreateServiceRequest & { sortOrder: number; isActive: boolean }>;
```

- [ ] **Step B2: Create `packages/shared-types/category.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ServiceDto } from './service';

export class CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: () => ServiceDto, isArray: true }) services!: ServiceDto[];
}

export class CreateCategoryRequest {
  @ApiProperty() name!: string;
  @ApiPropertyOptional() imageUrl?: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest & { sortOrder: number; isActive: boolean }>;
```

- [ ] **Step B3: Delete `packages/shared-types/practice-area.ts` and update `index.ts`**

Delete the file. In `packages/shared-types/index.ts`, replace
`export type * from './practice-area';` with:

```ts
export type * from './category';
export type * from './service';
```

### Part C — `categories/` and `services/` backend modules

- [ ] **Step C1: Add the `manageTaxonomy` admin permission**

In `apps/backend/src/auth/constants/admin-permissions.ts`, add `'manageTaxonomy'` to the
`AdminPermission` union and to `ALL_PERMISSIONS`, and add `'manageTaxonomy'` to
`content_manager`'s array (taxonomy feeds articles, which content_manager already manages).
`super_admin` gets it automatically via `ALL_PERMISSIONS`.

- [ ] **Step C2: Create `apps/backend/src/categories/categories.repository.ts`**

```ts
import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';

export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

const CATEGORY_COLUMNS = ['id', 'name', 'sortOrder:sort_order', 'imageUrl:image_url', 'isActive:is_active'] as const;
const SERVICE_COLUMNS = ['id', 'categoryId:category_id', 'name', 'sortOrder:sort_order', 'isCustom:is_custom', 'isActive:is_active'] as const;

export interface CategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ServiceRow {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  isCustom: boolean;
  isActive: boolean;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private categories() {
    return this.supabase.db.from('categories');
  }

  private services() {
    return this.supabase.db.from('services');
  }

  async findAllActiveWithServices(): Promise<(CategoryRow & { services: ServiceRow[] })[]> {
    const [{ data: categories, error: catError }, { data: services, error: svcError }] = await Promise.all([
      this.categories().select(CATEGORY_COLUMNS.join(', ')).eq('is_active', true).order('sort_order'),
      this.services().select(SERVICE_COLUMNS.join(', ')).eq('is_active', true).order('sort_order'),
    ]);
    if (catError || svcError) throw new InternalServerErrorException('Failed to load categories.');
    return this.attachServices(categories as unknown as CategoryRow[], services as unknown as ServiceRow[]);
  }

  async findAllWithServices(): Promise<(CategoryRow & { services: ServiceRow[] })[]> {
    const [{ data: categories, error: catError }, { data: services, error: svcError }] = await Promise.all([
      this.categories().select(CATEGORY_COLUMNS.join(', ')).order('sort_order'),
      this.services().select(SERVICE_COLUMNS.join(', ')).order('sort_order'),
    ]);
    if (catError || svcError) throw new InternalServerErrorException('Failed to load categories.');
    return this.attachServices(categories as unknown as CategoryRow[], services as unknown as ServiceRow[]);
  }

  async findServicesByCategoryId(categoryId: string): Promise<ServiceRow[]> {
    const { data, error } = await this.services().select(SERVICE_COLUMNS.join(', ')).eq('category_id', categoryId).order('sort_order');
    if (error) throw new InternalServerErrorException('Failed to load services.');
    return (data ?? []) as unknown as ServiceRow[];
  }

  private attachServices(categories: CategoryRow[], services: ServiceRow[]): (CategoryRow & { services: ServiceRow[] })[] {
    const byCategory = new Map<string, ServiceRow[]>();
    for (const s of services) {
      const list = byCategory.get(s.categoryId) ?? [];
      list.push(s);
      byCategory.set(s.categoryId, list);
    }
    return categories.map((c) => ({ ...c, services: byCategory.get(c.id) ?? [] }));
  }

  async findMaxSortOrder(): Promise<number> {
    const { data, error } = await this.categories().select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load categories.');
    return (data?.sort_order as number | undefined) ?? 0;
  }

  async insert(row: CategoryInsert): Promise<CategoryRow> {
    const { data: inserted, error } = await this.categories().insert(row).select(CATEGORY_COLUMNS.join(', ')).single();
    if (error || !inserted) throw new InternalServerErrorException('Failed to create category.');
    return inserted as unknown as CategoryRow;
  }

  async updateById(id: string, patch: CategoryUpdate): Promise<CategoryRow> {
    const { data: updated, error } = await this.categories().update(patch).eq('id', id).select(CATEGORY_COLUMNS.join(', ')).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update category.');
    if (!updated) throw new NotFoundException('Category not found.');
    return updated as unknown as CategoryRow;
  }

  async deleteById(id: string): Promise<void> {
    const { data, error } = await this.categories().delete().eq('id', id).select('id').maybeSingle();
    if (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException('Cannot delete a category that still has services. Delete or move its services first.');
      }
      throw new InternalServerErrorException('Failed to delete category.');
    }
    if (!data) throw new NotFoundException('Category not found.');
  }
}
```

- [ ] **Step C3: Create `apps/backend/src/categories/dto/create-category.dto.ts`**

```ts
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
```

- [ ] **Step C4: Create `apps/backend/src/categories/dto/update-category.dto.ts`**

```ts
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step C5: Create `apps/backend/src/categories/categories.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import type { CategoryDto } from '@shared/category';
import { CategoriesRepository, type CategoryRow, type ServiceRow } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async list(): Promise<CategoryDto[]> {
    const rows = await this.categoriesRepository.findAllActiveWithServices();
    return rows.map((r) => this.toDto(r));
  }

  async adminList(): Promise<CategoryDto[]> {
    const rows = await this.categoriesRepository.findAllWithServices();
    return rows.map((r) => this.toDto(r));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const sortOrder = (await this.categoriesRepository.findMaxSortOrder()) + 1;
    const inserted = await this.categoriesRepository.insert({
      name: dto.name,
      image_url: dto.imageUrl ?? null,
      sort_order: sortOrder,
    });
    return this.toDto({ ...inserted, services: [] });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.imageUrl !== undefined) patch.image_url = dto.imageUrl;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const updated = await this.categoriesRepository.updateById(id, patch);
    const services = await this.categoriesRepository.findServicesByCategoryId(id);
    return this.toDto({ ...updated, services });
  }

  async remove(id: string): Promise<void> {
    return this.categoriesRepository.deleteById(id);
  }

  private toDto(row: CategoryRow & { services: ServiceRow[] }): CategoryDto {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      services: row.services.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        sortOrder: s.sortOrder,
        isCustom: s.isCustom,
        isActive: s.isActive,
      })),
    };
  }
}
```

- [ ] **Step C6: Create `apps/backend/src/categories/categories.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CategoryDto } from '@shared/category';
import { CategoriesService } from './categories.service';

// 🌐 GET /v1/categories — the full active category→service tree, nested.
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categoriesService.list();
  }
}
```

- [ ] **Step C7: Create `apps/backend/src/categories/admin-categories.controller.ts`**

```ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CategoryDto } from '@shared/category';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// 🛡️ manageTaxonomy — direct admin CRUD over the category→service taxonomy.
@Roles('admin')
@RequiresPermission('manageTaxonomy')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categoriesService.adminList();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
```

- [ ] **Step C8: Create `apps/backend/src/categories/categories.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesController } from './categories.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

(`exports: [CategoriesService]` — `articles/` needs it for the suggest-topics random-sample
fallback, Part D.)

- [ ] **Step C9: Create `apps/backend/src/services/services.repository.ts`**

```ts
import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';

export type ServiceInsert = Database['public']['Tables']['services']['Insert'];
export type ServiceUpdate = Database['public']['Tables']['services']['Update'];

const SERVICE_COLUMNS = ['id', 'categoryId:category_id', 'name', 'sortOrder:sort_order', 'isCustom:is_custom', 'isActive:is_active'] as const;

export interface ServiceRow {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  isCustom: boolean;
  isActive: boolean;
}

@Injectable()
export class ServicesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private services() {
    return this.supabase.db.from('services');
  }

  async findMaxSortOrderInCategory(categoryId: string): Promise<number> {
    const { data, error } = await this.services()
      .select('sort_order')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load services.');
    return (data?.sort_order as number | undefined) ?? 0;
  }

  async insert(row: ServiceInsert): Promise<ServiceRow> {
    const { data: inserted, error } = await this.services().insert(row).select(SERVICE_COLUMNS.join(', ')).single();
    if (error || !inserted) throw new InternalServerErrorException('Failed to create service.');
    return inserted as unknown as ServiceRow;
  }

  async updateById(id: string, patch: ServiceUpdate): Promise<ServiceRow> {
    const { data: updated, error } = await this.services().update(patch).eq('id', id).select(SERVICE_COLUMNS.join(', ')).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update service.');
    if (!updated) throw new NotFoundException('Service not found.');
    return updated as unknown as ServiceRow;
  }

  async deleteById(id: string): Promise<void> {
    const { data, error } = await this.services().delete().eq('id', id).select('id').maybeSingle();
    if (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException('Cannot delete a service that members have selected. Deactivate it instead.');
      }
      throw new InternalServerErrorException('Failed to delete service.');
    }
    if (!data) throw new NotFoundException('Service not found.');
  }
}
```

- [ ] **Step C10: Create `apps/backend/src/services/dto/create-service.dto.ts`**

```ts
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}
```

- [ ] **Step C11: Create `apps/backend/src/services/dto/update-service.dto.ts`**

```ts
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step C12: Create `apps/backend/src/services/services.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import type { ServiceDto } from '@shared/service';
import { ServicesRepository, type ServiceRow } from './services.repository';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async create(categoryId: string, dto: CreateServiceDto): Promise<ServiceDto> {
    const sortOrder = (await this.servicesRepository.findMaxSortOrderInCategory(categoryId)) + 1;
    const inserted = await this.servicesRepository.insert({
      category_id: categoryId,
      name: dto.name,
      is_custom: dto.isCustom ?? false,
      sort_order: sortOrder,
    });
    return this.toDto(inserted);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceDto> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.isCustom !== undefined) patch.is_custom = dto.isCustom;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const updated = await this.servicesRepository.updateById(id, patch);
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    return this.servicesRepository.deleteById(id);
  }

  private toDto(row: ServiceRow): ServiceDto {
    return {
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      sortOrder: row.sortOrder,
      isCustom: row.isCustom,
      isActive: row.isActive,
    };
  }
}
```

- [ ] **Step C13: Create `apps/backend/src/services/admin-services.controller.ts`**

```ts
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { ServiceDto } from '@shared/service';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

// 🛡️ manageTaxonomy — services are always created scoped under their category.
@Roles('admin')
@RequiresPermission('manageTaxonomy')
@Controller('admin')
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('categories/:categoryId/services')
  create(@Param('categoryId') categoryId: string, @Body() dto: CreateServiceDto): Promise<ServiceDto> {
    return this.servicesService.create(categoryId, dto);
  }

  @Patch('services/:id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto): Promise<ServiceDto> {
    return this.servicesService.update(id, dto);
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.servicesService.remove(id);
  }
}
```

- [ ] **Step C14: Create `apps/backend/src/services/services.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminServicesController } from './admin-services.controller';
import { ServicesService } from './services.service';
import { ServicesRepository } from './services.repository';

@Module({
  imports: [AuthModule],
  controllers: [AdminServicesController],
  providers: [ServicesService, ServicesRepository],
})
export class ServicesModule {}
```

- [ ] **Step C15: Delete `apps/backend/src/practice-areas/` entirely**

```bash
rm -rf apps/backend/src/practice-areas
```

- [ ] **Step C16: Wire the new modules into `app.module.ts`**

Replace `import { PracticeAreasModule } from './practice-areas/practice-areas.module';` with:
```ts
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
```
and replace `PracticeAreasModule,` in the `imports` array with `CategoriesModule, ServicesModule,`.

### Part D — Repoint `articles/` (+ `ai/`)

- [ ] **Step D1: Update `packages/shared-types/article.ts`**

Replace `ArticlePracticeArea` with:
```ts
export class ArticleService {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() categoryName!: string;
}
```
On `ArticleDto` and `AdminArticleListItemDto`, rename `practiceAreas!: ArticlePracticeArea[]` to
`services!: ArticleService[]`. Add to `ArticleDto`:
```ts
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) customServiceLabels!: Record<string, string>;
```
On `CreateArticleRequest`, rename `practiceAreaIds!: string[]` to `serviceIds!: string[]` and add:
```ts
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } }) customServiceLabels?: Record<string, string>;
```
On `AiDraftArticleRequest` and `SuggestTopicsRequest`, rename `practiceAreaIds` to `serviceIds`.

- [ ] **Step D2: Update `apps/backend/src/articles/articles.repository.ts`**

Rename the `ArticleRow.practice_area_ids` field to `service_ids`, add `custom_service_labels:
Record<string, string>`. Update `ARTICLE_COLUMNS` (`'practice_area_ids'` → `'service_ids'`, add
`'custom_service_labels'`). Rename the `private practiceAreas()` accessor to `private services() {
return this.supabase.db.from('services'); }` and add `private categories() { return
this.supabase.db.from('categories'); }`. Replace `findActivePracticeAreaIds` and
`findPracticeAreaNames` with one combined method:

```ts
export interface ServiceDetail {
  name: string;
  categoryId: string;
  categoryName: string;
  isCustom: boolean;
  isActive: boolean;
}

async findServiceDetails(ids: string[]): Promise<Map<string, ServiceDetail>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const { data: services, error: servicesError } = await this.services()
    .select('id, name, category_id, is_custom, is_active')
    .in('id', uniqueIds);
  if (servicesError) throw new InternalServerErrorException('Failed to resolve services.');

  const categoryIds = [...new Set((services ?? []).map((s) => s.category_id as string))];
  const categoryNameById = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: categories, error: categoriesError } = await this.categories().select('id, name').in('id', categoryIds);
    if (categoriesError) throw new InternalServerErrorException('Failed to resolve categories.');
    for (const c of categories ?? []) categoryNameById.set(c.id as string, c.name as string);
  }

  return new Map(
    (services ?? []).map((s) => [
      s.id as string,
      {
        name: s.name as string,
        categoryId: s.category_id as string,
        categoryName: categoryNameById.get(s.category_id as string) ?? 'Unknown',
        isCustom: s.is_custom as boolean,
        isActive: s.is_active as boolean,
      },
    ])
  );
}
```

- [ ] **Step D3: Update `apps/backend/src/articles/articles.service.ts`**

Import `ArticleService` instead of `ArticlePracticeArea`; import `type { ServiceDetail } from
'./articles.repository'`. Replace `assertActivePracticeAreaIds` with:

```ts
private async assertActiveServiceIds(ids: string[], customLabels?: Record<string, string>): Promise<void> {
  const details = await this.articlesRepository.findServiceDetails(ids);
  const invalidIds = ids.filter((id) => !details.get(id)?.isActive);
  if (invalidIds.length > 0) {
    throw new BadRequestException(`Invalid or inactive service id(s): ${invalidIds.join(', ')}`);
  }
  const missingCustomLabels = ids.filter((id) => details.get(id)?.isCustom && !customLabels?.[id]?.trim());
  if (missingCustomLabels.length > 0) {
    throw new BadRequestException(`customServiceLabels required for custom service id(s): ${missingCustomLabels.join(', ')}`);
  }
}
```

Replace `resolvePracticeAreaNames`/`resolvePracticeAreaNamesList` with:
```ts
private async resolveServiceDetails(ids: string[]): Promise<Map<string, ServiceDetail>> {
  return this.articlesRepository.findServiceDetails(ids);
}

// Resolves service ids to their names, for use in a natural-language prompt.
async resolveServiceNamesList(ids: string[]): Promise<string[]> {
  const map = await this.resolveServiceDetails(ids);
  return ids.map((id) => map.get(id)?.name).filter((name): name is string => Boolean(name));
}
```

In `create`, `update`, `findOne`, `listMine`, `listForReview`, `review`, `toListDtos`: rename every
`row.practice_area_ids` to `row.service_ids`, every `this.resolvePracticeAreaNames(...)` call to
`this.resolveServiceDetails(...)`, and `dto.practiceAreaIds` to `dto.serviceIds`. In `create`/
`update`, change the validation call site to
`await this.assertActiveServiceIds(dto.serviceIds, dto.customServiceLabels)` and add
`patch.custom_service_labels = dto.customServiceLabels ?? {};` alongside the existing
`patch.practice_area_ids = dto.practiceAreaIds;` line (renamed to
`patch.service_ids = dto.serviceIds;`). In `listForReview`, replace the `practiceAreas:` mapping
with:
```ts
      services: row.service_ids
        .filter((id) => serviceDetails.has(id))
        .map((id) => {
          const d = serviceDetails.get(id)!;
          return { id, name: d.name, categoryId: d.categoryId, categoryName: d.categoryName };
        }),
```
(rename the local variable `practiceAreaNames` to `serviceDetails` everywhere it's produced by
`resolveServiceDetails`). Update module-level `toDto()`:
```ts
function toDto(row: ArticleRow, serviceDetails: Map<string, ServiceDetail>, authors: Map<string, AuthorInfo>): ArticleDto {
  const services: ArticleService[] = row.service_ids
    .filter((id) => serviceDetails.has(id))
    .map((id) => {
      const d = serviceDetails.get(id)!;
      return { id, name: d.name, categoryId: d.categoryId, categoryName: d.categoryName };
    });
  const author = authors.get(row.author_id);

  return {
    id: row.id,
    slug: row.slug,
    authorId: row.author_id,
    authorName: author?.name ?? 'Expertly Member',
    authorPhotoUrl: author?.photoUrl ?? null,
    authorHeadline: author?.headline ?? null,
    authorFirmName: author?.firmName ?? null,
    status: row.status,
    title: row.title,
    body: row.body,
    excerpt: row.excerpt,
    aiSummary: row.ai_summary,
    creationMode: row.creation_mode,
    readTimeMinutes: row.read_time_minutes,
    coverImageUrl: row.cover_image_url,
    services,
    customServiceLabels: row.custom_service_labels ?? {},
    countries: row.countries,
    state: row.state,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step D4: Update `apps/backend/src/articles/dto/create-article.dto.ts` and `update-article.dto.ts`**

Rename `practiceAreaIds` to `serviceIds` in both (keep the same `@IsArray() @ArrayMinSize(1)
@IsUUID('4', { each: true })` decorators). Add to both:
```ts
  @IsOptional()
  @IsObject()
  customServiceLabels?: Record<string, string>;
```
(add `IsObject` to the `class-validator` import list in both files).

- [ ] **Step D5: Update `apps/backend/src/ai/dto/suggest-topics.dto.ts` and `ai-draft-request.dto.ts`**

Rename `practiceAreaIds` to `serviceIds` in both (keep existing decorators unchanged).

- [ ] **Step D6: Update `apps/backend/src/ai/ai.service.ts`**

Rename the `practiceAreaNames` parameters (in `generateDraft` and `suggestTopics`) to
`serviceNames`, and update the prompt text: `` `Practice area(s): ${practiceAreaNames.join(', ')...` ``
→ `` `Service(s): ${serviceNames.join(', ') || 'unspecified'}` ``, and `` `Practice areas:
${practiceAreaNames.join(...)}` `` → `` `Services: ${serviceNames.join(', ') || 'general finance
and legal topics'}` ``. Update the `TOPICS_SYSTEM_PROMPT` line "The practice areas given below are
plain topic labels..." to say "The services given below are plain topic labels...".

- [ ] **Step D7: Update `apps/backend/src/articles/articles.controller.ts`**

Replace `import { PracticeAreasService } from '../practice-areas/practice-areas.service';` with
`import { CategoriesService } from '../categories/categories.service';`, and the constructor param
`practiceAreasService: PracticeAreasService` with `categoriesService: CategoriesService`. Rename
`dto.practiceAreaIds` to `dto.serviceIds` in `aiDraft`/`suggestTopics`, and
`this.articlesService.resolvePracticeAreaNamesList(...)` to `.resolveServiceNamesList(...)`.
Replace `sampleActivePracticeAreaNames`:
```ts
private async sampleActiveServiceNames(count: number): Promise<string[]> {
  const categories = await this.categoriesService.list();
  const allServices = categories.flatMap((c) => c.services);
  const shuffled = [...allServices].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((s) => s.name);
}
```
and update its one call site in `suggestTopics` to `this.sampleActiveServiceNames(...)`. Rename
the `RANDOM_PRACTICE_AREA_SAMPLE_SIZE` constant to `RANDOM_SERVICE_SAMPLE_SIZE`.

- [ ] **Step D8: Update `apps/backend/src/articles/articles.module.ts`**

Replace `import { PracticeAreasModule } from '../practice-areas/practice-areas.module';` with
`import { CategoriesModule } from '../categories/categories.module';`, and `PracticeAreasModule`
in the `imports` array with `CategoriesModule`.

### Part E — Repoint `applications/`

- [ ] **Step E1: Update `packages/shared-types/membership-application.ts`**

```ts
export class ServicePreferenceInput {
  @ApiProperty() serviceId!: string;
  @ApiProperty({ enum: [1, 2, 3] }) priority!: 1 | 2 | 3;
  @ApiPropertyOptional() customLabel?: string;
}

export class ServicePreference extends ServicePreferenceInput {
  /** Resolved server-side for display — not required on input. */
  @ApiProperty() serviceName!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() categoryName!: string;
}
```

- [ ] **Step E2: Update `apps/backend/src/applications/dto/service-preference.dto.ts`**

```ts
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ServicePreferenceDto {
  @IsUUID()
  serviceId!: string;

  @IsIn([1, 2, 3])
  priority!: 1 | 2 | 3;

  @IsOptional()
  @IsString()
  customLabel?: string;
}
```

- [ ] **Step E3: Update `apps/backend/src/applications/applications.repository.ts`**

Rename the `private practiceAreas()` accessor to `private services() { return
this.supabase.db.from('services'); }` and add `private categories() { return
this.supabase.db.from('categories'); }`. Replace `findPracticeAreaNames`/
`findActivePracticeAreaNames` with the same `findServiceDetails(ids): Promise<Map<string,
ServiceDetail>>` shape as Step D2 (copy verbatim — repositories don't share code in this
codebase, matching the existing convention). Change `insertMemberServices`:
```ts
async insertMemberServices(rows: { member_id: string; service_id: string; custom_label: string | null }[]): Promise<void> {
  const { error } = await this.memberServices().insert(rows);
  if (error) throw new InternalServerErrorException('Failed to provision member services.');
}
```

- [ ] **Step E4: Update `apps/backend/src/applications/applications.service.ts`**

Replace `resolvePracticeAreaNames`/`assertActiveAndResolve` with:
```ts
private async resolveServiceDetails(servicePreferences: { serviceId: string }[]): Promise<Map<string, ServiceDetail>> {
  if (servicePreferences.length === 0) return new Map();
  return this.applicationsRepository.findServiceDetails(servicePreferences.map((p) => p.serviceId));
}

private async assertActiveAndResolveServices(
  servicePreferences: { serviceId: string; customLabel?: string }[]
): Promise<Map<string, ServiceDetail>> {
  if (servicePreferences.length === 0) return new Map();

  const ids = servicePreferences.map((p) => p.serviceId);
  const details = await this.applicationsRepository.findServiceDetails(ids);

  const invalidIds = ids.filter((id) => !details.get(id)?.isActive);
  if (invalidIds.length > 0) {
    throw new BadRequestException(`Invalid or inactive service id(s): ${invalidIds.join(', ')}`);
  }
  const missingCustomLabels = servicePreferences
    .filter((p) => details.get(p.serviceId)?.isCustom && !p.customLabel?.trim())
    .map((p) => p.serviceId);
  if (missingCustomLabels.length > 0) {
    throw new BadRequestException(`customLabel required for custom service id(s): ${missingCustomLabels.join(', ')}`);
  }
  return details;
}
```
Import `type { ServiceDetail } from './applications.repository'` (added there in Step E3). Update
every call site: `saveOrSubmit` uses `dto.servicePreferences` (already named that on the DTO —
only the inner `practiceAreaId` key changes, via `ServicePreferenceDto`), rename
`practiceAreaById` locals to `serviceDetails`, `resolvePracticeAreaNames` calls to
`resolveServiceDetails`, `assertActiveAndResolve` calls to `assertActiveAndResolveServices`.
In `reviewApplication`:
```ts
const servicePreferences = (application.service_preferences ?? []) as { serviceId: string; customLabel?: string }[];
if (servicePreferences.length > 0) {
  await this.applicationsRepository.insertMemberServices(
    servicePreferences.map((p) => ({
      member_id: application.applicant_id,
      service_id: p.serviceId,
      custom_label: p.customLabel ?? null,
    }))
  );
}
```
Update `toDto`:
```ts
private async toDto(row: ApplicationRow, serviceDetails: Map<string, ServiceDetail>): Promise<ApplicationDto> {
  const servicePreferences: ServicePreference[] = (row.service_preferences ?? []).map(
    (p: { serviceId: string; priority: 1 | 2 | 3; customLabel?: string }) => {
      const detail = serviceDetails.get(p.serviceId);
      return {
        serviceId: p.serviceId,
        priority: p.priority,
        customLabel: p.customLabel,
        serviceName: detail?.name ?? 'Unknown',
        categoryId: detail?.categoryId ?? '',
        categoryName: detail?.categoryName ?? 'Unknown',
      };
    }
  );
  // ...rest unchanged
}
```

### Part F — Repoint `members/`

- [ ] **Step F1: Update `packages/shared-types/member.ts`**

Replace `MemberPracticeArea` with:
```ts
export class MemberService {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() categoryName!: string;
}
```
Rename every `practiceAreas!: MemberPracticeArea[]` field (on `MemberListItemDto`/`MemberDto`, or
wherever else it appears in this file) to `services!: MemberService[]`.

- [ ] **Step F2: Update `apps/backend/src/members/members.repository.ts`**

Rename the `private practiceAreas()` accessor to `private services() { return
this.supabase.db.from('services'); }` and add `private categories() { return
this.supabase.db.from('categories'); }`. Replace `findMemberIdsByPracticeAreas`:
```ts
async findMemberIdsByServices(serviceIds: string[]): Promise<Set<string>> {
  const { data, error } = await this.memberServices().select('member_id').in('service_id', serviceIds);
  if (error) throw new InternalServerErrorException('Failed to filter by service.');
  return new Set((data ?? []).map((m) => m.member_id as string));
}

async findMemberIdsByCategory(categoryId: string): Promise<Set<string>> {
  const { data: services, error: servicesError } = await this.services().select('id').eq('category_id', categoryId);
  if (servicesError) throw new InternalServerErrorException('Failed to filter by category.');
  const serviceIds = (services ?? []).map((s) => s.id as string);
  if (serviceIds.length === 0) return new Set();
  return this.findMemberIdsByServices(serviceIds);
}
```
Replace `findMemberServicesByMemberIds`:
```ts
async findMemberServicesByMemberIds(
  memberIds: string[]
): Promise<Map<string, { id: string; name: string; categoryId: string; categoryName: string }[]>> {
  const map = new Map<string, { id: string; name: string; categoryId: string; categoryName: string }[]>();
  if (memberIds.length === 0) return map;

  const { data: links, error } = await this.memberServices().select('member_id, service_id').in('member_id', memberIds);
  if (error) throw new InternalServerErrorException('Failed to load member services.');

  const serviceIds = [...new Set((links ?? []).map((l) => l.service_id as string))];
  const serviceById = new Map<string, { name: string; categoryId: string }>();
  if (serviceIds.length > 0) {
    const { data: services } = await this.services().select('id, name, category_id').in('id', serviceIds);
    for (const s of services ?? []) serviceById.set(s.id as string, { name: s.name as string, categoryId: s.category_id as string });
  }

  const categoryIds = [...new Set([...serviceById.values()].map((s) => s.categoryId))];
  const categoryNameById = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: categories } = await this.categories().select('id, name').in('id', categoryIds);
    for (const c of categories ?? []) categoryNameById.set(c.id as string, c.name as string);
  }

  for (const link of links ?? []) {
    const memberId = link.member_id as string;
    const serviceId = link.service_id as string;
    const service = serviceById.get(serviceId);
    const list = map.get(memberId) ?? [];
    list.push({
      id: serviceId,
      name: service?.name ?? 'Unknown',
      categoryId: service?.categoryId ?? '',
      categoryName: service ? categoryNameById.get(service.categoryId) ?? 'Unknown' : 'Unknown',
    });
    map.set(memberId, list);
  }
  return map;
}
```

- [ ] **Step F3: Update `apps/backend/src/members/members.service.ts`**

In `list()`'s query parameter type, replace `practiceAreaId?: string[]` with `serviceId?:
string[]; categoryId?: string;`. Replace the filter block:
```ts
if (query.serviceId && query.serviceId.length > 0) {
  const matchedIds = await this.membersRepository.findMemberIdsByServices(query.serviceId);
  rows = rows.filter((r) => matchedIds.has(r.profile_id));
} else if (query.categoryId) {
  const matchedIds = await this.membersRepository.findMemberIdsByCategory(query.categoryId);
  rows = rows.filter((r) => matchedIds.has(r.profile_id));
}
```
In `toListDto`, rename `practiceAreas: servicesByMember.get(row.profile_id) ?? []` to `services:
servicesByMember.get(row.profile_id) ?? []`.

- [ ] **Step F4: Update `apps/backend/src/members/members.controller.ts`**

In `list()`, replace the `@Query('practiceAreaId') practiceAreaId?: string | string[]` parameter
with `@Query('serviceId') serviceId?: string | string[]` and add `@Query('categoryId') categoryId?:
string`. Update the call: `this.membersService.list({ q, serviceId: toArray(serviceId),
categoryId, country: toArray(country), ... })`.

### Part G — Full verification and commit

- [ ] **Step G1: Typecheck**

```bash
cd /Users/shreyans/Personal/Projects/expertly-website
pnpm --filter ./apps/backend typecheck
```

Expected: clean pass. If not, the error will name the one remaining `practice_area`/`practiceArea`
reference — grep for it (`grep -rn "practiceArea\|practice_area" apps/backend/src
packages/shared-types`) and fix per whichever Part above owns that file.

- [ ] **Step G2: Start the dev server and smoke-test every changed/new endpoint**

```bash
pnpm --filter ./apps/backend dev
```

In another shell (replace `$TOKEN` with a real JWT for a signed-in admin/member — see
`docs/auth.md` for how to get one in dev):

```bash
curl -s http://localhost:3000/v1/categories | head -c 500
# expect: JSON array of 17 categories, each with a nested `services` array

curl -s -X POST http://localhost:3000/v1/admin/categories \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Category"}'
# expect: 201-shaped body with the new category, empty services array, sortOrder 18

curl -s -X POST "http://localhost:3000/v1/admin/categories/<idFromAbove>/services" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Service"}'
# expect: the new service, isCustom false, sortOrder 1

curl -s -X DELETE "http://localhost:3000/v1/admin/services/<serviceIdFromAbove>" \
  -H "Authorization: Bearer $TOKEN" -i
# expect: 204

curl -s -X DELETE "http://localhost:3000/v1/admin/categories/<idFromAbove>" \
  -H "Authorization: Bearer $TOKEN" -i
# expect: 204 (its only service was already deleted, so this succeeds)

curl -s "http://localhost:3000/v1/members?serviceId=<someRealServiceIdFrom/v1/categories>" \
  | head -c 500
# expect: filtered member list, no 500

curl -s -X POST http://localhost:3000/v1/articles \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Smoke test","body":"<p>'"$(python3 -c 'print("word "*450)')"'</p>","coverImageUrl":"https://example.com/x.jpg","serviceIds":["<someRealServiceId>"],"countries":["United States"],"status":"draft"}'
# expect: 201-shaped ArticleDto with a `services` array (not `practiceAreas`) and `customServiceLabels: {}`
```

Fix anything that 500s before proceeding — this is the task's real "does it work" gate, not just
the typecheck.

- [ ] **Step G3: Commit**

```bash
git add packages/shared-types apps/backend/src
git commit -m "$(cat <<'EOF'
feat(backend): repoint articles/applications/members to the services taxonomy

Adds categories/ and services/ modules (public read + admin CRUD),
removes practice-areas/, and updates every consumer's shared-types and
repository/service code to the new service_id/service_ids/serviceId
shapes with custom-label support.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update `docs/database-erd.md` and `docs/rest-api.md`

**Files:**
- Modify: `docs/database-erd.md`, `docs/rest-api.md`

- [ ] **Step 1: Replace the `practice_areas` section in `docs/database-erd.md`**

Replace the entire `### \`practice_areas\`` section (name, category enum table, image_url notes)
with a `### \`categories\` / \`services\`` section describing: the two-table split, that
`services.category_id` has no `ON DELETE` clause (blocks deleting a category with services, caught
as a 409), the `is_custom`/custom-label sidecar-column convention (list every table that carries
one: `member_services.custom_label`, `articles.custom_service_labels`,
`membership_applications.service_preferences[].customLabel`, `consultation_requests.custom_service_label`),
and a link to `docs/superpowers/specs/2026-09-19-category-service-taxonomy-design.md` for the full
seed list instead of reproducing 138 rows in the doc.

- [ ] **Step 2: Update every other reference in `docs/database-erd.md`**

Update the `membership_applications`/`articles`/`member_services` sections' prose and column
tables: `practice_area_ids` → `service_ids` (+ new `custom_service_labels` row), `practiceAreaId`
→ `serviceId` (+ new `customLabel`), `practice_area_id` → `service_id` on `member_services` (+ new
`custom_label` row) and `consultation_requests` (+ new `custom_service_label` row), and every
"practice area"/"practice areas" prose reference to "service"/"services" (keep "category" prose
referring to the new `categories` table, not the old enum).

- [ ] **Step 3: Replace the `GET /v1/practice-areas` section in `docs/rest-api.md`**

Replace `### 🌐 \`GET /v1/practice-areas\`` with:

```markdown
### 🌐 `GET /v1/categories`

Returns every active category with its active services nested, for the application wizard's
service-preference picker, the article write flow's tagging UI, and the member directory's
category/service filter.

**Response `200`:** `CategoryDto[]` — `{ id, name, sortOrder, imageUrl: string | null, isActive,
services: { id, categoryId, name, sortOrder, isCustom, isActive }[] }[]`. A service with
`isCustom: true` is a "Other (please specify)" placeholder — selecting it requires supplying a
`customLabel`/`customServiceLabel` wherever that service id is written (see the
`membership_applications`/`articles`/`member_services` sections below).

### 🛡️ `manageTaxonomy` admin CRUD

`GET/POST/PATCH/DELETE /v1/admin/categories[/:id]`, `POST
/v1/admin/categories/:categoryId/services`, `PATCH/DELETE /v1/admin/services/:id`. `DELETE` on
either a category with services, or a service still referenced by any `member_services` row,
returns `409` — deactivate (`PATCH isActive: false`) instead.
```

- [ ] **Step 4: Update every other reference in `docs/rest-api.md`**

Update the `servicePreferences[].practiceAreaId`/`practiceAreaIds` mentions (membership
applications, articles, member directory filter query param, AI draft/suggest-topics sections) to
`serviceId`/`serviceIds`, and note the new `categoryId` member-directory filter query param
alongside `serviceId`.

- [ ] **Step 5: Commit**

```bash
git add docs/database-erd.md docs/rest-api.md
git commit -m "$(cat <<'EOF'
docs: update database-erd/rest-api for the categories/services taxonomy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
