-- 0008 — recommendation requests and contact verification.
--
-- Context: member self-edits now go live immediately instead of waiting in the moderation queue
-- (member_profile_edits). Items carry `isVerified` (already inside the section JSONB) and show
-- "Pending Verification" until an admin verifies them; a pending entry just invites the member to
-- add proof, so there is no admin-to-member messaging table. This migration adds the state that
-- model needs and that JSONB can't hold:
--   1. member_profiles.contact_verified — contact is a set of columns (not a JSONB list), so its
--      verified flag is one boolean for the whole block.
--   2. recommendation_requests — a member asking another member for a recommendation.
-- Plus one email automation (disabled until its Resend template is published).
--
-- Additive and safe on live data: one new column with a default, one new table, a seed row with
-- ON CONFLICT DO NOTHING. Re-runnable (IF NOT EXISTS / guarded). No existing row is touched, so
-- already-verified items stay verified and nothing is backfilled.

begin;

-- ── contact verification ─────────────────────────────────────────────────────────────────────
alter table public.member_profiles
  add column if not exists contact_verified boolean not null default false;

-- ── enums ────────────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.recommendation_request_status as enum ('pending', 'fulfilled', 'ignored', 'cancelled');
exception when duplicate_object then null; end $$;

-- ── recommendation_requests ──────────────────────────────────────────────────────────────────
-- A member asking another member for a recommendation. Fulfilled automatically when the recipient
-- posts a recommendation for the requester (member_recommendations); "ignored" is a silent decline
-- the requester is never told about (LinkedIn's behaviour); "cancelled" is the requester withdrawing.
create table if not exists public.recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  recipient_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status public.recommendation_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint recommendation_requests_not_self check (requester_id <> recipient_id)
);

-- At most one open request per pair; the 30-day cooldown after ignored/cancelled is a service rule.
create unique index if not exists recommendation_requests_one_pending_idx
  on public.recommendation_requests (requester_id, recipient_id) where status = 'pending';
create index if not exists recommendation_requests_recipient_idx
  on public.recommendation_requests (recipient_id, status, created_at desc);
create index if not exists recommendation_requests_requester_idx
  on public.recommendation_requests (requester_id, created_at desc);

drop trigger if exists set_recommendation_requests_updated_at on public.recommendation_requests;
create trigger set_recommendation_requests_updated_at
  before update on public.recommendation_requests
  for each row execute function public.set_updated_at();

alter table public.recommendation_requests enable row level security;

drop policy if exists recommendation_requests_select_participant on public.recommendation_requests;
create policy recommendation_requests_select_participant
  on public.recommendation_requests for select
  to authenticated
  using ((select auth.uid()) in (requester_id, recipient_id));

-- ── email automations (disabled until the Resend templates exist) ────────────────────────────
insert into public.email_automations (key, name, description, resend_template, enabled) values
  ('recommendation_requested', 'Recommendation requested',
   'Sent to a member when another member asks them for a recommendation.',
   'recommendation-requested', false)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

commit;
