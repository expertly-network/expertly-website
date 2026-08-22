-- Expertly: Member Directory & Profiles.
--
-- IMPORTANT — read before applying: this migration is written as an ADDITIVE extension of the
-- database as it actually exists live today (profiles / practice_areas / membership_applications,
-- confirmed via `psql "$DATABASE_URL"` against the project's real Supabase instance), NOT of the
-- schema described in 0001_initial_schema.sql as currently checked into git. That file has drifted
-- from what's actually deployed — it was rewritten ("squashed") to a `services`/`categories`
-- naming plus `articles`/`events`/`consultation_requests`/`peer_connect_*` tables that do not exist
-- on the live database, and it is written to assume a from-scratch DB (`create type profile_role`,
-- etc.), so running it as-is against the live instance would fail on already-existing objects. This
-- is a pre-existing, project-wide inconsistency discovered while building this feature, not
-- something this migration attempts to fix — see the session report for the full explanation and
-- the decision this needs from whoever owns the database. Consequence for this file specifically:
-- it references `public.practice_areas` (the table that is actually live), not `public.services`.
--
-- Source: design/static_html/members.html, member-profile.html (3099 lines), dashboard.html,
-- dashboard-alt-3.html, admin-dashboard.html's member panels, assets/members.js,
-- assets/admin-data.js — read in full per CLAUDE.md's methodology. See docs/database-erd.md for
-- the full narrative writeup of every decision below.

-- ============================================================================
-- Admin sub-tier permissions — ported from admin-data.js's existing (client-side-only) model:
-- super_admin / content_manager / reviewer. The permission-to-role mapping itself lives as a
-- backend TypeScript constant (apps/backend/src/auth/constants/admin-permissions.ts), not a DB
-- table — same "simplest thing that works, no admin UI to manage it yet" call already made for
-- coupons (see docs/database-erd.md). Only the role tag itself is real column data.
-- ============================================================================

create type public.admin_role as enum ('super_admin', 'content_manager', 'reviewer');

alter table public.profiles
  add column admin_role public.admin_role;

comment on column public.profiles.admin_role is
  'Only meaningful when role=''admin''. Null for a plain admin (treated as super_admin by the '
  'permission guard) and for every client/member row.';

-- ============================================================================
-- member_profiles — extends profiles 1:1 for role='member'. id IS the profile id (not a separate
-- owner_user_id FK) since this is a detail/extension table, not an independently-owned resource
-- the way articles are.
-- ============================================================================

create type public.member_profile_status as enum ('active', 'deactivated');
create type public.renewal_payment_status as enum ('paid', 'pending', 'overdue');

create table public.member_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,

  headline text,
  bio text,
  -- Null means independent/no firm — the prototype bakes the literal string 'Independent' into
  -- the data; deliberately not reproduced here (see docs/database-erd.md). Render the label at
  -- the UI layer instead.
  firm_name text,
  firm_website text,

  -- Current location, not a snapshot of where the applicant was at submission time — reuses
  -- membership_applications' region enum/country-as-free-text shape for the same concept, but
  -- lives here separately since a member's location can change after approval and the directory
  -- needs to filter/display the current value, not the application-time one.
  region public.application_region,
  country text not null,
  state text,
  city text,

  years_of_experience smallint not null check (years_of_experience between 0 and 60),
  -- Same naming as membership_applications.rate_min_cents/rate_max_cents for the same concept —
  -- deliberately not "fee_range_*", for consistency across the schema.
  rate_min_cents integer check (rate_min_cents >= 0),
  rate_max_cents integer check (rate_max_cents > rate_min_cents),
  -- ISO 4217 code, not the prototype's literal '$' — every seed profile in the prototype is USD;
  -- stored as a real currency code so a future non-USD member doesn't require a schema change.
  rate_currency text not null default 'USD',

  member_tier public.membership_tier not null,
  is_available boolean not null default true,
  availability_notes text,

  contact_email citext,
  contact_phone text,
  linkedin_url text,
  website text,

  is_verified boolean not null default false,
  photo_url text,
  status public.member_profile_status not null default 'active',

  -- Set when a member was provisioned via an approved application (the eventual, not-yet-built
  -- "approve application" flow — see docs/rest-api.md's Membership applications deferred list);
  -- null for a member added directly by an admin.
  application_id uuid references public.membership_applications (id),

  -- Renewal — deliberately minimal. Only two stored facts; everything else (due/due-soon/overdue)
  -- is always computed at read time from these plus member_renewal_policy below, never persisted,
  -- so there's nothing to keep in sync. renewal_payment_status is a manual admin override,
  -- nullable — null means "no override, compute due-state normally."
  membership_started_at timestamptz not null default now(),
  renewal_payment_status public.renewal_payment_status,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_profiles_status_idx on public.member_profiles (status);
create index member_profiles_member_tier_idx on public.member_profiles (member_tier);

create trigger set_member_profiles_updated_at
  before update on public.member_profiles
  for each row execute function public.set_updated_at();

alter table public.member_profiles enable row level security;

-- Defense-in-depth only (service-role backend bypasses this) — mirrors articles_select_published:
-- an active member's directory-listed profile is meant to be public information regardless of the
-- API-layer sign-in gate on the full-detail endpoint (that gate is a product/engagement decision,
-- not a data-sensitivity one — see docs/rest-api.md).
create policy member_profiles_select_active
  on public.member_profiles for select
  using (status = 'active');

create policy member_profiles_select_own
  on public.member_profiles for select
  using (auth.uid() = id);

-- ============================================================================
-- member_services — practice areas a member is approved/listed for. A real join table (not the
-- application's JSONB-array shortcut): the prototype's own directory search filters by practice
-- area, and this needs a real FK the application's write-once service_preferences didn't need.
-- References practice_areas (the table that actually exists live) — see the header note.
-- ============================================================================

create table public.member_services (
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  practice_area_id uuid not null references public.practice_areas (id),
  primary key (member_id, practice_area_id)
);

create index member_services_practice_area_id_idx on public.member_services (practice_area_id);

alter table public.member_services enable row level security;

create policy member_services_select_all
  on public.member_services for select
  using (true);

-- ============================================================================
-- Child tables — one row per item, real tables (not JSONB) because, unlike the application's
-- immutable write-once snapshot, these are: searched/filtered on individually (a future
-- "employer" search), edited one section at a time via the self-edit moderation flow below, and
-- some carry a real per-item verification flag. See docs/database-erd.md for the full reasoning.
-- ============================================================================

create table public.member_work_experiences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  title text not null,
  company text not null,
  start_year smallint not null,
  end_year smallint,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

create table public.member_educations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  degree text not null,
  institution text not null,
  field text,
  end_year smallint,
  created_at timestamptz not null default now()
);

create table public.member_engagements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  title text not null,
  organization text not null,
  year smallint,
  url text,
  created_at timestamptz not null default now()
);

-- Distinct from member_credentials below: no issuing body, no verification flag. Confirmed a real
-- distinction in the prototype, not redundant with credentials.
create table public.member_qualifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  name text not null,
  year smallint,
  created_at timestamptz not null default now()
);

create table public.member_credentials (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  name text not null,
  issuing_body text,
  year smallint,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.member_testimonials (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  quote text not null,
  client_name text not null,
  client_title text,
  client_company text,
  service_name text,
  -- The prototype stores this as free text ("March 2026"); a real date column instead, formatted
  -- at render time.
  occurred_on date,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.member_awards (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  title text not null,
  issuing_body text,
  year smallint,
  description text,
  created_at timestamptz not null default now()
);

-- Reconciles the prototype's two logo sources (a `domain` favicon-lookup for seed data, a real
-- uploaded file for self-edit submissions) into one resolvable url — see docs/database-erd.md.
create table public.member_key_clients (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  name text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create index member_work_experiences_member_id_idx on public.member_work_experiences (member_id);
create index member_educations_member_id_idx on public.member_educations (member_id);
create index member_engagements_member_id_idx on public.member_engagements (member_id);
create index member_qualifications_member_id_idx on public.member_qualifications (member_id);
create index member_credentials_member_id_idx on public.member_credentials (member_id);
create index member_testimonials_member_id_idx on public.member_testimonials (member_id);
create index member_awards_member_id_idx on public.member_awards (member_id);
create index member_key_clients_member_id_idx on public.member_key_clients (member_id);

alter table public.member_work_experiences enable row level security;
alter table public.member_educations enable row level security;
alter table public.member_engagements enable row level security;
alter table public.member_qualifications enable row level security;
alter table public.member_credentials enable row level security;
alter table public.member_testimonials enable row level security;
alter table public.member_awards enable row level security;
alter table public.member_key_clients enable row level security;

-- Same "public profile content" reasoning as member_services above.
create policy member_work_experiences_select_all on public.member_work_experiences for select using (true);
create policy member_educations_select_all on public.member_educations for select using (true);
create policy member_engagements_select_all on public.member_engagements for select using (true);
create policy member_qualifications_select_all on public.member_qualifications for select using (true);
create policy member_credentials_select_all on public.member_credentials for select using (true);
create policy member_testimonials_select_all on public.member_testimonials for select using (true);
create policy member_awards_select_all on public.member_awards for select using (true);
create policy member_key_clients_select_all on public.member_key_clients for select using (true);

-- ============================================================================
-- member_profile_edits — the self-edit moderation queue. Replaces the prototype's two redundant
-- localStorage keys (PROFILE_EDITS + PROFILE_OVERRIDES — an "override" is just the payload of the
-- latest verified edit for that member+section) with one table. Proof requirement varies by
-- section per the actual save logic in member-profile.html (confirmed, not assumed):
--   - headline_bio, contact: no proof at all
--   - education, work_experiences: one shared proof for the whole batch submission
--     (proof_file_url/proof_link on the edit row itself)
--   - engagements, testimonials, awards, key_clients: proof/asset required per item, embedded in
--     each payload array element — payload stays jsonb since per-item shape already varies.
-- On approval, payload becomes the live value for that member+section (child tables for the
-- array-shaped sections are fully replaced; headline_bio/contact overwrite member_profiles columns
-- directly) — a whole-section-request workflow, confirmed from the admin UI approving/rejecting
-- one edit request at a time, not per item. Not built by this migration: the endpoint logic that
-- performs that replace-on-approval — see apps/backend/src/members/.
-- ============================================================================

create type public.member_edit_section as enum (
  'headline_bio', 'contact', 'engagements', 'education', 'work_experiences',
  'key_clients', 'testimonials', 'awards'
);
create type public.member_edit_status as enum ('pending', 'verified', 'rejected');

create table public.member_profile_edits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (id) on delete cascade,
  section public.member_edit_section not null,
  payload jsonb not null,
  proof_file_url text,
  proof_link text,
  status public.member_edit_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_profile_edits_member_id_idx on public.member_profile_edits (member_id);
create index member_profile_edits_status_idx on public.member_profile_edits (status);

create trigger set_member_profile_edits_updated_at
  before update on public.member_profile_edits
  for each row execute function public.set_updated_at();

alter table public.member_profile_edits enable row level security;

-- Private (contains a member's not-yet-public submissions and admin review notes) — owner-only,
-- same posture as membership_applications_select_own. No public policy.
create policy member_profile_edits_select_own
  on public.member_profile_edits for select
  using (auth.uid() = member_id);

-- ============================================================================
-- member_renewal_policy — one sitewide row (not per-member, not versioned: the prototype and the
-- confirmed real policy both have exactly one active policy at a time). period_months=12,
-- reminder_days=30 are the confirmed real business values (not prototype placeholders left
-- unconfirmed). Due-state is always computed from this + member_profiles.membership_started_at,
-- never persisted.
-- ============================================================================

create table public.member_renewal_policy (
  id smallint primary key default 1 check (id = 1),
  period_months smallint not null default 12 check (period_months > 0),
  reminder_days smallint not null default 30 check (reminder_days >= 0),
  updated_at timestamptz not null default now()
);

create trigger set_member_renewal_policy_updated_at
  before update on public.member_renewal_policy
  for each row execute function public.set_updated_at();

insert into public.member_renewal_policy (id, period_months, reminder_days) values (1, 12, 30);

-- Locked down — no public/owner select policy. Only the service-role backend (admin endpoints,
-- and the due-state computation on every member read) touches this table.
alter table public.member_renewal_policy enable row level security;

-- ============================================================================
-- Storage — member-proofs bucket, backing POST /v1/members/:id/uploads (signed-upload-URL flow;
-- see docs/rest-api.md). Private (not public) — proof files/logos are served back through the
-- backend, never a direct public URL. Objects are keyed "<memberId>/<filename>", so the RLS
-- policy below can scope a member to their own folder even though the API is the primary
-- authorization boundary (same defense-in-depth posture as every RLS policy above).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('member-proofs', 'member-proofs', false)
on conflict (id) do nothing;

create policy member_proofs_owner_rw
  on storage.objects for all
  using (bucket_id = 'member-proofs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'member-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
