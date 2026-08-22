-- Expertly: full initial schema.
--
-- Single consolidated migration (squashed from what was previously 0001-0006) — the DB is
-- rebuilt from scratch from this one file, so it reflects final table shapes directly rather
-- than the incremental history that produced them (e.g. profiles already has every column it
-- ended up with; there's no separate practice_areas table that later got replaced). See
-- ../../CLAUDE.md and docs/database-erd.md for the design rationale behind each section.
--
-- Apply via the Supabase SQL Editor or `supabase db push`.

create extension if not exists citext;

-- ============================================================================
-- profiles — extends Supabase Auth (auth.users) with the app's role model.
-- ============================================================================

create type profile_role as enum ('client', 'member', 'admin');
create type profile_status as enum ('active', 'suspended', 'deleted');
create type auth_provider as enum ('email', 'linkedin_oidc', 'google');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  role profile_role not null default 'client',
  status profile_status not null default 'active',
  first_name text not null,
  last_name text not null,
  phone_country_code text,
  phone text,
  avatar_url text,
  initials text,
  auth_provider auth_provider not null default 'email',
  timezone text not null default 'UTC',
  consent jsonb not null default '{}',
  deletion_reason text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index profiles_email_key on public.profiles (email);
create index profiles_role_idx on public.profiles (role);

-- Keep updated_at current on every row change, for every table below too.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth.users row gets a matching profiles row. Always starts as 'client' —
-- becoming a 'member' only happens via an approved membership application; 'admin' is set
-- directly by a super-admin/migration, never self-service. Reads both our own signUp()
-- metadata keys (first_name/last_name) and the OIDC standard claim names LinkedIn's
-- integration actually populates (given_name/family_name), so both signup paths work.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'given_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data ->> 'family_name', ''),
    'client'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync if a user changes their Supabase Auth login email.
create function public.handle_user_email_sync()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_sync();

-- RLS: defense in depth. Only a SELECT-own-row policy exists — this app has no self-service
-- profile-edit UI yet, and inserts only ever happen via the `security definer` trigger above
-- (which bypasses RLS by nature), so leaving writes locked down is intentional.
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

-- Custom Access Token Hook: injects `app_role` into the JWT as a fast-path claim for the
-- NestJS backend. Created here but INERT until manually registered in the Supabase dashboard
-- under Authentication -> Hooks -> "Custom Access Token" — that registration step can't be
-- done via SQL/CLI.
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role text;
begin
  select role into user_role from public.profiles where id = (event ->> 'user_id')::uuid;
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{app_role}', to_jsonb(coalesce(user_role, 'client')));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- ============================================================================
-- categories / services — practice-area taxonomy. `services` backs the practice-area
-- picker in the membership application wizard and article write flow (id-only references,
-- no FK — see membership_applications.service_preferences and articles.practice_area_ids
-- below); `categories` backs the category-pill filter grouping them.
-- ============================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  regions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_category_id_idx on public.services (category_id);

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger set_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.services enable row level security;

create policy categories_select_all
  on public.categories for select
  using (true);

create policy services_select_all
  on public.services for select
  using (true);

-- Seed data, sourced from design/static_html/assets/members.js's EXPERTLY_PRACTICE_AREAS and
-- assets/onboarding-form.js's category-per-practice-area mapping — notably not a naive
-- legal-vs-finance split: Banking & Finance is `legal`, while Antitrust and Compliance are
-- `finance-advisory`.
insert into public.categories (name, slug) values
  ('Taxation', 'taxation'),
  ('Legal', 'legal'),
  ('Finance & Advisory', 'finance-advisory');

insert into public.services (category_id, name, slug)
select c.id, s.name, s.slug
from (values
  ('M&A Tax', 'ma-tax', 'taxation'),
  ('Transfer Pricing', 'transfer-pricing', 'taxation'),
  ('Indirect Tax', 'indirect-tax', 'taxation'),
  ('Corporate Law', 'corporate-law', 'legal'),
  ('IP & Technology', 'ip-technology', 'legal'),
  ('Banking & Finance', 'banking-finance', 'legal'),
  ('Dispute Resolution', 'dispute-resolution', 'legal'),
  ('Capital Markets', 'capital-markets', 'finance-advisory'),
  ('Private Equity', 'private-equity', 'finance-advisory'),
  ('Restructuring', 'restructuring', 'finance-advisory'),
  ('Compliance', 'compliance', 'finance-advisory'),
  ('Antitrust', 'antitrust', 'finance-advisory')
) as s(name, slug, category_slug)
join public.categories c on c.slug = s.category_slug;

-- ============================================================================
-- membership_applications — a client applies to become a member. Approving an application
-- (deferred admin feature, not built by this migration) is the only path that provisions a
-- member_profiles row (see docs/database-erd.md's target shape, a separate future backend
-- session) and flips profiles.role to 'member'.
-- ============================================================================

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

  -- Background (step 3). Stored as JSONB, not child tables — this is an immutable
  -- submission record (written once at submit, read as a whole for review, never queried or
  -- edited per-entry), unlike the eventual *member*-side equivalents (a separate, later
  -- feature) which do need per-entry search/edit. Matches the frontend wizard's own
  -- array-of-objects shape exactly, no relational mapping needed. Trade-off: individual
  -- sub-fields (e.g. firmSize) aren't DB-type-enforced — validated at the DTO layer instead.
  --
  -- work_experiences element shape: { title, company, city, firmSize, companyUrl, startMonth,
  --   startYear, endMonth, endYear, isCurrent }
  -- educations element shape: { institution, degree, fieldOfStudy, startYear, endYear }
  years_of_experience smallint not null check (years_of_experience between 0 and 60),
  work_experiences jsonb not null default '[]'
    check (jsonb_typeof(work_experiences) = 'array'),
  educations jsonb not null default '[]'
    check (jsonb_typeof(educations) = 'array'),

  -- Services & rates (step 4). service_preferences: [{ serviceId, priority }, ...], up to 3
  -- entries. JSONB, not a join table with a real FK to services — a deliberate trade-off:
  -- the backend MUST validate every serviceId against a live services lookup before insert,
  -- since nothing at the database level will catch a dangling/invalid reference (e.g. to a
  -- service later renamed or deactivated). Do not skip that check in any write path — there
  -- is no FK/CASCADE safety net here the way there is elsewhere in this schema.
  service_preferences jsonb not null default '[]'
    check (jsonb_typeof(service_preferences) = 'array'),
  rate_min_cents integer not null check (rate_min_cents >= 0),
  rate_max_cents integer not null check (rate_max_cents > rate_min_cents),

  -- Payment (coupon-only, no real gateway integration yet). selected_tier is auto-derived
  -- from years_of_experience at submission time (>12 years -> seasoned_professional per
  -- current product rule); the operations team can override the final tier at approval time
  -- — that override lives on member_profiles (a later feature), not here, since this table
  -- is an immutable submission record.
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

  -- Review (deferred admin feature — columns exist now so the lifecycle is modeled
  -- correctly; no endpoint writes them yet)
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

-- RLS: defense in depth, matching the posture on profiles. The backend API (service-role,
-- bypasses RLS) is the primary authorization path; these policies protect against
-- direct/anon access.
alter table public.membership_applications enable row level security;

create policy membership_applications_select_own
  on public.membership_applications for select
  using (auth.uid() = applicant_id);

-- ============================================================================
-- articles — a member (or admin) writes an article, published immediately (no editorial
-- review queue this iteration). Owner or admin can later flip status back to draft
-- (self-service unpublish).
-- ============================================================================

create type article_status as enum ('draft', 'published');

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  status article_status not null default 'draft',
  title text not null,
  slug text not null unique,
  body text not null,
  -- Always server-derived from body (truncated excerpt, word-count-based read time) — never
  -- accepted from the client.
  excerpt text not null,
  ai_summary text,
  read_time_minutes smallint not null,
  cover_image_url text not null,
  creation_mode text not null default 'manual',
  -- No FK — arrays can't reference a table. Same load-bearing trade-off as
  -- membership_applications.service_preferences: the backend MUST validate every id against
  -- a live, is_active-filtered services query before insert/update. Unlike the write path,
  -- *reading* an article's services back deliberately does not filter by is_active — an
  -- already-published article should keep showing the real name of a service even if it's
  -- since been deactivated.
  practice_area_ids uuid[] not null default '{}',
  country text not null,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_author_id_idx on public.articles (author_id);
create index articles_status_idx on public.articles (status);

create trigger set_articles_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

alter table public.articles enable row level security;

create policy articles_select_published
  on public.articles for select
  using (status = 'published');

create policy articles_select_own
  on public.articles for select
  using (auth.uid() = author_id);

-- ============================================================================
-- events — public suggestion + admin-curated listing. `status` is the single source of
-- truth for publish state (no separate is_published flag to drift out of sync with it),
-- same pattern as articles.status.
-- ============================================================================

create type event_status as enum ('draft', 'published');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  short_description text,
  cover_image_url text,
  start_date timestamptz not null,
  end_date timestamptz,
  timezone text,
  event_type text,
  event_format text check (event_format in ('in_person', 'virtual', 'hybrid')),
  country text,
  city text,
  venue_name text,
  is_free boolean not null default false,
  registration_url text,
  organiser_name text,
  status event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_status_idx on public.events (status);

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy events_select_published
  on public.events for select
  using (status = 'published');

-- ============================================================================
-- consultation_requests — a client (or peer member) requests a consultation with a member.
-- requester_id/member_id point at profiles (not a separate members table, which doesn't
-- exist yet) — same pattern as membership_applications.applicant_id.
-- ============================================================================

create type consultation_status as enum ('pending', 'completed', 'declined');

create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  subject text,
  message text not null,
  description text,
  status consultation_status not null default 'pending',
  scheduled_at timestamptz,
  response_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consultation_requests_requester_id_idx on public.consultation_requests (requester_id);
create index consultation_requests_member_id_idx on public.consultation_requests (member_id);
create index consultation_requests_service_id_idx on public.consultation_requests (service_id);
create index consultation_requests_status_idx on public.consultation_requests (status);

create trigger set_consultation_requests_updated_at
  before update on public.consultation_requests
  for each row execute function public.set_updated_at();

alter table public.consultation_requests enable row level security;

create policy consultation_requests_select_requester
  on public.consultation_requests for select
  using (auth.uid() = requester_id);

create policy consultation_requests_select_member
  on public.consultation_requests for select
  using (auth.uid() = member_id);

-- ============================================================================
-- Peer Connect — automated monthly 1:1 peer-matching program for members. Two tables, both
-- prefixed peer_connect_ so it's unambiguous they belong to this one feature:
--
--   * peer_connect_member_preferences — 1 row/member/month. A member's full cycle lifecycle
--     in one place: their preferences (submitted before matching even runs), which match they
--     ended up in (nullable — a member can exist here with no match), why they *didn't* get
--     matched if that's what happened, and their own private rating/feedback/note about the
--     meeting (nullable until the meeting happens). This is private data — RLS restricts it
--     to the member's own row, same posture as profiles. Chosen over the alternative
--     (rating/feedback as member1_/member2_ columns directly on the match row) because
--     Postgres RLS is row-level, not column-level — there'd be no DB-level way to hide one
--     participant's private column from the other; this shape lets RLS actually enforce the
--     "never visible to the matched peer" requirement instead of just trusting the backend
--     never to leak it.
--   * peer_connect_matches — 1 row/pair/month. Only exists once two members are actually
--     paired. Holds what's shared between both participants: the meeting itself (schedule,
--     link, transcript), the AI "why we matched you" blurb, the key-actions list (either
--     participant can add/remove one — JSONB array, same not-a-child-table pattern as
--     membership_applications.work_experiences, since these are small mutable lists with no
--     concurrent-write risk worth a real table for), and the *current* reschedule-proposal
--     state (columns, not a request-history table or status enum — presence/absence of
--     reschedule_confirmed_date tells you pending vs. resolved; the prototype itself only ever
--     shows the current proposal, never a history of past ones).
--
-- `cycle_month` (first-of-month) is a plain, unreferenced date on both tables rather than a
-- FK into a persisted cycle-config table — deliberately: everything about a cycle
-- (preferences window, matching date, the 2nd-Tuesday meeting day, the fixed 10:00-10:30 IST
-- slot) is pure date math off cycle_month with no admin override anywhere in the design (no
-- Peer Connect admin surface exists in admin-dashboard.html/admin-data.js at all), so a
-- separate table would just be an operational dependency — something has to seed next month's
-- row before matching can run — for values a backend utility function can compute for free.
-- Revisit only if a real per-month override requirement shows up.
--
-- Deliberately NOT modeled here (see docs/roadmap.md's Peer Connect section): the matching
-- algorithm, video-call provider integration, and AI transcription pipeline. These tables only
-- store their outputs.
-- ============================================================================

create type public.peer_connect_match_status as enum ('scheduled', 'completed', 'cancelled');

create table public.peer_connect_matches (
  id uuid primary key default gen_random_uuid(),
  cycle_month date not null,
  match_rationale text,
  status peer_connect_match_status not null default 'scheduled',
  scheduled_date date not null,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  meeting_link text,
  transcript text,
  duration_minutes smallint,
  -- [{ id, description, createdBy, createdAt }, ...] — shared, either participant can add/
  -- remove an item. No FK (arrays/JSONB can't reference a table) — createdBy is validated
  -- against a live profiles query by the backend, same load-bearing trade-off already
  -- documented on membership_applications.service_preferences and articles.practice_area_ids.
  action_items jsonb not null default '[]'
    check (jsonb_typeof(action_items) = 'array'),
  -- Current reschedule proposal only (no history table) — status is inferred from which of
  -- these are set: all null = no active reschedule; requested_by + proposed_dates set,
  -- confirmed_date null = pending; confirmed_date set = accepted (scheduled_date/start/end
  -- get updated to match at the same time). Declining or cancelling just nulls all three out
  -- again — the prototype never shows a past-reschedule history, so neither does this.
  reschedule_requested_by uuid references public.profiles (id),
  reschedule_proposed_dates date[] check (array_length(reschedule_proposed_dates, 1) between 1 and 3),
  reschedule_confirmed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index peer_connect_matches_cycle_month_idx on public.peer_connect_matches (cycle_month);
create index peer_connect_matches_status_idx on public.peer_connect_matches (status);
create index peer_connect_matches_reschedule_requested_by_idx on public.peer_connect_matches (reschedule_requested_by);

create trigger set_peer_connect_matches_updated_at
  before update on public.peer_connect_matches
  for each row execute function public.set_updated_at();

-- RLS enabled here; the actual select policy is added at the end of this section, once
-- peer_connect_member_preferences exists — it looks up match membership through that table.
alter table public.peer_connect_matches enable row level security;

create type public.peer_connect_unmatched_reason as enum (
  'odd_headcount', 'no_compatible_peer', 'inactive_member', 'other'
);

create table public.peer_connect_member_preferences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  cycle_month date not null,

  -- Preferences (step: "Set Preferences"). Entirely optional — a member can skip the form
  -- entirely, in which case matching falls back to their profile defaults; there's no
  -- separate "skipped" flag since the outcome (no explicit preference) is identical either
  -- way. No FK on practice_area_ids — same trade-off as articles.practice_area_ids.
  practice_area_ids uuid[] not null default '{}',
  preferred_countries text[] not null default '{}',
  preferred_hours_start numeric(4,2) check (preferred_hours_start between 0 and 24),
  preferred_hours_end numeric(4,2) check (preferred_hours_end between 0 and 24),

  -- Outcome, filled in once the matching algorithm has run for this cycle.
  match_id uuid references public.peer_connect_matches (id),
  unmatched_reason peer_connect_unmatched_reason,
  unmatched_note text,

  -- Private post-meeting fields — filled in after the match's meeting happens. Never exposed
  -- to the matched peer; RLS below restricts this whole table to the member's own row.
  rating smallint check (rating between 1 and 5),
  feedback text,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (member_id, cycle_month)
);

create index peer_connect_member_preferences_cycle_month_idx on public.peer_connect_member_preferences (cycle_month);
create index peer_connect_member_preferences_match_id_idx on public.peer_connect_member_preferences (match_id);

create trigger set_peer_connect_member_preferences_updated_at
  before update on public.peer_connect_member_preferences
  for each row execute function public.set_updated_at();

-- RLS: own-row only — this table carries private rating/feedback/note, unlike
-- peer_connect_matches above which both participants can read. A match's *other*
-- participant's public identity (name, avatar, firm) comes from profiles via a backend-side
-- join, not from this table.
alter table public.peer_connect_member_preferences enable row level security;

create policy peer_connect_member_preferences_select_own
  on public.peer_connect_member_preferences for select
  using (auth.uid() = member_id);

-- peer_connect_matches' select policy, added here (not alongside its own RLS enable above)
-- because it looks up match membership through peer_connect_member_preferences, which didn't
-- exist yet at that point.
create policy peer_connect_matches_select_participant
  on public.peer_connect_matches for select
  using (
    exists (
      select 1 from public.peer_connect_member_preferences pcm
      where pcm.match_id = peer_connect_matches.id and pcm.member_id = auth.uid()
    )
  );
