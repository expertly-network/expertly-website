-- Membership application flow: a client applies to become a member. Approving
-- an application (deferred admin feature, not built by this migration) is the
-- only path that provisions a member_profiles row and flips profiles.role to
-- 'member' — see ../../CLAUDE.md and ../../docs/database-erd.md.
--
-- Lives here (not db/migrations/) because its RLS policies use auth.uid() —
-- per db/migrations/README.md's own test, that alone makes it Supabase-
-- coupled even though every FK just targets profiles.id, a table we own.

create type application_status as enum ('submitted', 'under_review', 'approved', 'rejected');
create type application_region as enum (
  'asia_pacific', 'europe', 'latin_america', 'middle_east', 'north_america', 'south_asia', 'africa'
);
create type membership_tier as enum ('budding_entrepreneur', 'seasoned_professional');
create type billing_period as enum ('monthly', 'annual');
create type payment_status as enum ('pending', 'waived', 'paid');

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  status application_status not null default 'submitted',

  -- Identity (step 2)
  photo_url text,
  first_name text not null,
  last_name text not null,
  contact_email citext not null,
  phone_country_code text,
  phone text,
  region application_region not null,
  country text not null,
  state text,
  city text,
  linkedin_url text not null,
  bio varchar(500) not null,

  -- Background (step 3). Stored as JSONB, not child tables — this is an
  -- immutable submission record (written once at submit, read as a whole for
  -- review, never queried or edited per-entry), so none of the reasons that
  -- justify normalizing the eventual *member*-side equivalents
  -- (member_work_experiences etc. — directory search, admin editing one
  -- entry — a separate, later feature) apply here. Matches the frontend
  -- wizard's own array-of-objects shape exactly, no relational mapping
  -- needed. Trade-off: individual sub-fields (e.g. firm_size) aren't
  -- DB-type-enforced — validated at the DTO layer instead, same as every
  -- other field on the single request this table is built from.
  --
  -- work_experiences element shape: { title, company, city, firmSize,
  --   companyUrl, startMonth, startYear, endMonth, endYear, isCurrent }
  -- educations element shape: { institution, degree, fieldOfStudy,
  --   startYear, endYear }
  years_of_experience smallint not null check (years_of_experience between 0 and 60),
  work_experiences jsonb not null default '[]'
    check (jsonb_typeof(work_experiences) = 'array'),
  educations jsonb not null default '[]'
    check (jsonb_typeof(educations) = 'array'),

  -- Services & rates (step 4). service_preferences: [{ practiceAreaId,
  -- priority }, ...], up to 3 entries. JSONB, not a join table with a real FK
  -- to practice_areas — a deliberate trade-off, not an oversight: the
  -- backend MUST validate every practiceAreaId against a live practice_areas
  -- lookup before insert, since nothing at the database level will catch a
  -- dangling/invalid reference (e.g. to a practice area later renamed or
  -- deactivated). Do not skip that check in any write path — there is no
  -- FK/CASCADE safety net here the way there is elsewhere in this schema.
  service_preferences jsonb not null default '[]'
    check (jsonb_typeof(service_preferences) = 'array'),
  rate_min_cents integer not null check (rate_min_cents >= 0),
  rate_max_cents integer not null check (rate_max_cents > rate_min_cents),

  -- Payment (new step — not in the original design; coupon-only, no real
  -- gateway integration yet). selected_tier is auto-derived from
  -- years_of_experience at submission time (>12 years -> seasoned_professional
  -- per current product rule); the operations team can override the final
  -- tier at approval time — that override lives on member_profiles (a later
  -- feature), not here, since this table is an immutable submission record.
  selected_tier membership_tier not null,
  billing_period billing_period not null,
  list_price_cents integer not null,
  coupon_code text,
  discount_amount_cents integer not null default 0,
  amount_due_cents integer not null check (amount_due_cents >= 0),
  payment_status payment_status not null default 'pending',

  -- Declarations (step 5)
  linkedin_import_consent boolean not null default false,
  terms_version_agreed text not null,
  privacy_version_agreed text not null,
  background_check_consent boolean not null,

  -- Review (deferred admin feature — columns exist now so the lifecycle is
  -- modeled correctly; no endpoint writes them yet)
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index membership_applications_applicant_id_idx on public.membership_applications (applicant_id);
create index membership_applications_status_idx on public.membership_applications (status);

create trigger set_membership_applications_updated_at
  before update on public.membership_applications
  for each row execute function public.set_updated_at();

-- Practice-area taxonomy. Still a real table (not JSONB) even though
-- service_preferences above no longer FKs into it — this is the lookup the
-- backend validates practiceAreaId against, and what the future member
-- directory's filter will use. Minimal for now.
create table public.practice_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS: defense in depth, matching the posture in 0001_profiles_and_auth.sql.
-- The backend API (service-role, bypasses RLS) is the primary authorization
-- path; these policies protect against direct/anon access.
alter table public.membership_applications enable row level security;
alter table public.practice_areas enable row level security;

create policy membership_applications_select_own
  on public.membership_applications for select
  using (auth.uid() = applicant_id);

create policy practice_areas_select_all
  on public.practice_areas for select
  using (true);

-- Seed data: the 12 practice areas from design/static_html/assets/members.js's
-- EXPERTLY_PRACTICE_AREAS (names only — member-count/icon/image there are
-- directory-page display concerns, not this table's job).
insert into public.practice_areas (name) values
  ('M&A Tax'),
  ('Transfer Pricing'),
  ('Corporate Law'),
  ('Capital Markets'),
  ('IP & Technology'),
  ('Banking & Finance'),
  ('Dispute Resolution'),
  ('Private Equity'),
  ('Antitrust'),
  ('Restructuring'),
  ('Indirect Tax'),
  ('Compliance');
