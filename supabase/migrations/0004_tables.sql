-- Expertly: all tables, indexes, trigger attachments, RLS, policies, and seed data.
--
-- The DB is rebuilt from scratch from this file (plus 0001_extensions.sql, 0002_enums.sql,
-- 0003_functions.sql before it), so it reflects final table shapes directly rather than the
-- incremental history that produced them. See 0001_extensions.sql's header for the four-file
-- split, and supabase/migrations/README.md for the pre-production convention that keeps this as
-- one set of files rather than an accumulating migration history — that changes the day this
-- repo ships to production; from that point on, changes are additive migrations, never edits to
-- this file.
--
-- Practice-area taxonomy is a single `practice_areas` table (id, name, category, is_active) —
-- an earlier draft split this into `categories` + `services`, but that was never applied to any
-- real database and every backend module (`practice-areas/`, `articles/`, `applications/`,
-- `members/`) already queries `practice_areas`. `practice_areas` is correct; don't reintroduce
-- categories/services.
--
-- Apply via the Supabase SQL Editor or `supabase db push`.

-- ============================================================================
-- profiles — extends Supabase Auth (auth.users) with the app's role model.
-- ============================================================================

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
  -- Only meaningful when role='admin'. Null for a plain admin (treated as super_admin by the
  -- permission guard) and for every client/member row.
  admin_role admin_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index profiles_email_key on public.profiles (email);
create index profiles_role_idx on public.profiles (role);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

-- ============================================================================
-- practice_areas — the practice-area taxonomy. One flat table: `category` groups areas for the
-- category-pill filter, `name` is what's picked in the application wizard / article write flow
-- / member services. Referenced by id (no FK) from membership_applications.service_preferences
-- and articles.practice_area_ids — see those sections for why; referenced by a real FK from
-- member_services and consultation_requests, which do need one.
-- ============================================================================

create table public.practice_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category practice_area_category not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index practice_areas_category_idx on public.practice_areas (category);

alter table public.practice_areas enable row level security;

create policy practice_areas_select_all
  on public.practice_areas for select
  using (true);

-- Seed data, sourced from design/static_html/assets/members.js's EXPERTLY_PRACTICE_AREAS and
-- assets/onboarding-form.js's category-per-practice-area mapping — notably not a naive
-- legal-vs-finance split: Banking & Finance is `legal`, while Antitrust and Compliance are
-- `finance_advisory`.
insert into public.practice_areas (name, category) values
  ('M&A Tax', 'taxation'),
  ('Transfer Pricing', 'taxation'),
  ('Indirect Tax', 'taxation'),
  ('Corporate Law', 'legal'),
  ('IP & Technology', 'legal'),
  ('Banking & Finance', 'legal'),
  ('Dispute Resolution', 'legal'),
  ('Capital Markets', 'finance_advisory'),
  ('Private Equity', 'finance_advisory'),
  ('Restructuring', 'finance_advisory'),
  ('Compliance', 'finance_advisory'),
  ('Antitrust', 'finance_advisory');

-- ============================================================================
-- membership_applications — a client applies to become a member. Rows start as an in-place-
-- mutable 'draft' (see current_step/photo_path/documents below) across multiple wizard saves;
-- once 'submitted' the row is treated as an immutable snapshot again (written once at the submit
-- transition, read as a whole for review, never edited per-entry) — 'draft' is the one
-- deliberate exception to that immutability, not a change to the principle itself. Approving an
-- application (PATCH /v1/admin/applications/:id) is the only path that provisions a
-- member_profiles row (see docs/database-erd.md's target shape) and flips profiles.role to
-- 'member'.
-- ============================================================================

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  status application_status not null default 'draft',
  -- Which wizard step to resume on. Only meaningful while status = 'draft'.
  current_step smallint not null default 1,

  -- Identity (step 2). Every column below this point that used to be `not null` is now
  -- nullable — a draft row can be arbitrarily incomplete. Completeness for status='submitted' is
  -- enforced in ApplicationsService (assertComplete), not here — same "cross-field rules live in
  -- the service" convention this schema already uses for rate_min/max_cents ordering.
  --
  -- photo_path: private Storage path (application-assets bucket, see below), not a public URL —
  -- a signed URL is minted at read time by ApplicationsService.toDto().
  photo_path text,
  first_name text,
  last_name text,
  contact_email citext,
  phone_country_code text,
  phone text,
  region application_region,
  country text,
  state text,
  city text,
  linkedin_url text,
  bio varchar(500),

  -- Background (step 3). Stored as JSONB, not child tables — see the immutable-submission-record
  -- rationale in the table comment above; matches the frontend wizard's own array-of-objects
  -- shape exactly, no relational mapping needed. Trade-off: individual sub-fields (e.g. firmSize)
  -- aren't DB-type-enforced — validated at the DTO layer instead.
  --
  -- work_experiences element shape: { title, company, city, firmSize, companyUrl, startMonth,
  --   startYear, endMonth, endYear, isCurrent }
  -- educations element shape: { institution, degree, fieldOfStudy, startYear, endYear }
  years_of_experience smallint check (years_of_experience between 0 and 60),
  work_experiences jsonb not null default '[]'
    check (jsonb_typeof(work_experiences) = 'array'),
  educations jsonb not null default '[]'
    check (jsonb_typeof(educations) = 'array'),

  -- Documents (photo lives on photo_path above; this is the generic/extensible slot — array of
  -- {id, filename, path, mimeType, sizeBytes, uploadedAt}). Only the profile photo has upload UI
  -- in the initial iteration, but future document types don't need another migration.
  documents jsonb not null default '[]' check (jsonb_typeof(documents) = 'array'),

  -- Services & rates (step 4). service_preferences: [{ practiceAreaId, priority }, ...], up to
  -- 3 entries. JSONB, not a join table with a real FK to practice_areas — a deliberate
  -- trade-off: the backend MUST validate every practiceAreaId against a live practice_areas
  -- lookup before insert, since nothing at the database level will catch a dangling/invalid
  -- reference (e.g. to a practice area later renamed or deactivated). Do not skip that check in
  -- any write path — there is no FK/CASCADE safety net here the way there is elsewhere in this
  -- schema.
  service_preferences jsonb not null default '[]'
    check (jsonb_typeof(service_preferences) = 'array'),
  rate_min_cents integer check (rate_min_cents >= 0),
  rate_max_cents integer check (rate_max_cents > rate_min_cents),

  -- Payment (coupon-only, no real gateway integration yet). selected_tier is auto-derived
  -- from years_of_experience at submission time (>12 years -> seasoned_professional per
  -- current product rule); the operations team can override the final tier at approval time
  -- — that override lives on member_profiles (below), not here, since this table is an
  -- immutable submission record. All of these are computed/stamped only at the submit
  -- transition, hence nullable here.
  selected_tier membership_tier,
  billing_period billing_period,
  list_price_cents integer,
  coupon_code text,
  discount_amount_cents integer not null default 0,
  amount_due_cents integer check (amount_due_cents >= 0),
  payment_status payment_status,

  -- Declarations (step 5)
  linkedin_import_consent boolean not null default false,
  terms_version_agreed text,
  privacy_version_agreed text,
  background_check_consent boolean,

  -- Review — PATCH /v1/admin/applications/:id writes these on approve/reject.
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
  -- a live, is_active-filtered practice_areas query before insert/update. Unlike the write
  -- path, *reading* an article's practice areas back deliberately does not filter by
  -- is_active — an already-published article should keep showing the real name of a practice
  -- area even if it's since been deactivated.
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

create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  practice_area_id uuid references public.practice_areas (id) on delete set null,
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
create index consultation_requests_practice_area_id_idx on public.consultation_requests (practice_area_id);
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

-- ============================================================================
-- member_profiles — extends profiles 1:1 for role='member'. `id` is its own generated surrogate
-- key (not shared with `profiles.id`); `profile_id` is a separate, unique-constrained FK to
-- `profiles.id` — that's the column everything else in this schema's "member_id" columns
-- (member_services, member_profile_edits, consultation_requests, peer_connect_*) actually
-- references, and what auth.uid() is compared against in every RLS/ownership check. `id` itself
-- has no other table pointing at it — it exists purely so this table has a real, independent
-- primary key like every other table, not because anything needs it as a join target.
--
-- Source: design/static_html/members.html, member-profile.html (3099 lines), dashboard.html,
-- dashboard-alt-3.html, admin-dashboard.html's member panels, assets/members.js,
-- assets/admin-data.js — read in full per CLAUDE.md's methodology. See docs/database-erd.md for
-- the full narrative writeup of every decision below.
-- ============================================================================

create table public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,

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

  -- Repeating profile-content sections. jsonb arrays, not child tables — the self-edit
  -- moderation flow below (member_profile_edits) already writes/replaces a whole section's
  -- payload at once, never a single item, so a jsonb column matches the real write pattern
  -- (one UPDATE) better than delete+insert across a child table. Per-item id is assigned by
  -- the application layer (there's no DB-generated id here, unlike a real table's uuid PK).
  -- member_services below stays a real join table, not jsonb — it needs a real FK to
  -- practice_areas and is filtered on directly by the directory's practice-area search, which
  -- these sections are not. member_credentials/member_testimonials keep a per-item is_verified
  -- flag inside their jsonb objects; there's no per-item admin query/index need for it today
  -- (only ever read back as part of the whole member profile), so this doesn't need a real
  -- column either.
  work_experiences jsonb not null default '[]' check (jsonb_typeof(work_experiences) = 'array'),
  educations jsonb not null default '[]' check (jsonb_typeof(educations) = 'array'),
  engagements jsonb not null default '[]' check (jsonb_typeof(engagements) = 'array'),
  -- confirmed distinct from credentials below — no issuing body, no verification flag.
  qualifications jsonb not null default '[]' check (jsonb_typeof(qualifications) = 'array'),
  credentials jsonb not null default '[]' check (jsonb_typeof(credentials) = 'array'),
  -- occurredOn is a real ISO date string, not the prototype's free-text "March 2026" — format
  -- at render time. No rating/star field — confirmed absent from every seeded testimonial;
  -- don't confuse with the unrelated Peer Connect post-meeting rating.
  testimonials jsonb not null default '[]' check (jsonb_typeof(testimonials) = 'array'),
  awards jsonb not null default '[]' check (jsonb_typeof(awards) = 'array'),
  -- Reconciles the prototype's two logo sources (a `domain` favicon-lookup for seed data, a
  -- real uploaded file for self-edit submissions) into one resolvable logoUrl field per item.
  key_clients jsonb not null default '[]' check (jsonb_typeof(key_clients) = 'array'),

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
  using (auth.uid() = profile_id);

-- ============================================================================
-- member_services — practice areas a member is approved/listed for. A real join table (not a
-- jsonb array like member_profiles' sections above): the directory search filters by practice
-- area, and this needs a real FK the jsonb sections don't. References member_profiles(profile_id)
-- rather than member_profiles(id) — same reasoning as member_profile_edits below.
-- ============================================================================

create table public.member_services (
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  practice_area_id uuid not null references public.practice_areas (id),
  primary key (member_id, practice_area_id)
);

create index member_services_practice_area_id_idx on public.member_services (practice_area_id);

alter table public.member_services enable row level security;

create policy member_services_select_all
  on public.member_services for select
  using (true);

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
-- On approval, payload becomes the live value for that member+section: for the array-shaped
-- sections, it wholesale-replaces the matching jsonb column on member_profiles (a single UPDATE,
-- assigning each item a fresh application-generated id); for headline_bio/contact, the matching
-- member_profiles columns are overwritten directly. This is a deliberate whole-section-request
-- workflow (the admin UI approves/rejects one edit request at a time, not per item), confirmed
-- from the actual admin UI. Not built by this migration: the endpoint logic that performs that
-- replace-on-approval — see apps/backend/src/members/.
--
-- `member_id` references member_profiles(profile_id), not member_profiles(id) — so it holds the
-- same value as profiles.id, same as every other "member_id" column in this schema
-- (member_services, consultation_requests, peer_connect_*), and member_profile_edits_select_own
-- below can compare it against auth.uid() directly with no join.
-- ============================================================================

create table public.member_profile_edits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
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

-- ============================================================================
-- Storage — application-assets bucket, backing POST /v1/applications/me/uploads. Unlike
-- member-proofs' signed-upload-URL flow, uploads here are proxied through the backend (see
-- ApplicationsService.uploadFile) so magic-byte MIME validation is actually possible before the
-- object is written — a signed-upload-URL flow never puts the file's bytes through the API.
-- Private (not public); a signed URL is minted at read time. Objects are keyed
-- "members/application/<applicantId>/profile-photo.<ext>" or "...document-<n>.<ext>", so index 3
-- (1-indexed: members, application, <applicantId>, ...) is the applicant id.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('application-assets', 'application-assets', false)
on conflict (id) do nothing;

create policy application_assets_owner_all
  on storage.objects for all
  using (bucket_id = 'application-assets' and (storage.foldername(name))[3] = auth.uid()::text)
  with check (bucket_id = 'application-assets' and (storage.foldername(name))[3] = auth.uid()::text);
