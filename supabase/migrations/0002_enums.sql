-- Expertly: all enum types (final consolidated state), grouped here (not alongside each table)
-- so `0003_functions.sql` can reference them (e.g. casting to `auth_provider`) and
-- `0004_tables.sql`'s table definitions aren't interleaved with type declarations. See
-- 0001_extensions.sql's header for the four-file split this belongs to.

-- ── profiles ─────────────────────────────────────────────────────────────────

create type public.profile_role as enum ('client', 'member', 'admin');
create type public.profile_status as enum ('active', 'suspended', 'deleted');
create type public.auth_provider as enum ('email', 'linkedin_oidc', 'google');

-- Admin sub-tier — ported from the design prototype's client-side-only admin-data.js model
-- (super_admin / content_manager / reviewer). The permission-to-role mapping itself lives as a
-- backend TypeScript constant (apps/backend/src/auth/constants/admin-permissions.ts), not a DB
-- table — same "simplest thing that works, no admin UI to manage it yet" call already made for
-- coupons (see docs/database-erd.md). Only the role tag itself is real column data.
create type public.admin_role as enum ('super_admin', 'content_manager', 'reviewer');

-- ── practice_areas ───────────────────────────────────────────────────────────

create type public.practice_area_category as enum ('taxation', 'legal', 'finance_advisory');

-- ── membership_applications ──────────────────────────────────────────────────

create type public.application_status as enum ('submitted', 'under_review', 'approved', 'rejected');
create type public.application_region as enum (
  'asia_pacific', 'europe', 'latin_america', 'middle_east', 'north_america', 'south_asia', 'africa'
);
create type public.membership_tier as enum ('budding_entrepreneur', 'seasoned_professional');
create type public.billing_period as enum ('monthly', 'annual');
create type public.payment_status as enum ('pending', 'waived', 'paid');

-- ── articles ──────────────────────────────────────────────────────────────────

create type public.article_status as enum ('draft', 'published');

-- ── events ────────────────────────────────────────────────────────────────────

create type public.event_status as enum ('draft', 'published');

-- ── consultation_requests ────────────────────────────────────────────────────

create type public.consultation_status as enum ('pending', 'completed', 'declined');

-- ── Peer Connect ──────────────────────────────────────────────────────────────

create type public.peer_connect_match_status as enum ('scheduled', 'completed', 'cancelled');
create type public.peer_connect_unmatched_reason as enum (
  'odd_headcount', 'no_compatible_peer', 'inactive_member', 'other'
);

-- ── member_profiles ───────────────────────────────────────────────────────────

create type public.member_profile_status as enum ('active', 'deactivated');
create type public.renewal_payment_status as enum ('paid', 'pending', 'overdue');

-- ── member_profile_edits ──────────────────────────────────────────────────────

create type public.member_edit_section as enum (
  'headline_bio', 'contact', 'engagements', 'education', 'work_experiences',
  'key_clients', 'testimonials', 'awards'
);
create type public.member_edit_status as enum ('pending', 'verified', 'rejected');
