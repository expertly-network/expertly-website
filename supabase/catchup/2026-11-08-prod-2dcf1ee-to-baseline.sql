-- GrowXQ production catch-up (one-off, 2026-11-08): production runs the 2dcf1ee images. The only
-- schema change since 2dcf1ee is the member profile-view counter (daily_stats +
-- record_member_profile_view), folded into 0003_functions.sql / 0004_tables.sql. After this the
-- production database matches the go-live baseline (supabase/migrations/0001–0006 as of ae6c2a5);
-- from 2026-11-09 every schema change is a new numbered migration (0007, …).
--
-- Run BEFORE pinning production to a newer image. Paste into the production Supabase SQL editor
-- and Run. One transaction; safe to re-run (if not exists / create or replace).
begin;

-- Guard: this script assumes the database already has the 2dcf1ee schema (consent policies,
-- work email, email engine). If not, stop here and change nothing.
do $$
begin
  if to_regclass('public.consent_policies') is null
     or to_regclass('public.email_messages') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'membership_applications'
                      and column_name = 'work_email') then
    raise exception 'Database is behind 2dcf1ee (consent_policies / email engine / work_email missing). Nothing was changed — apply the full catch-up first.';
  end if;
end $$;

-- daily_stats — per-subject, per-day counters (see 0004_tables.sql for the design notes).
create table if not exists public.daily_stats (
  subject_type text not null check (subject_type in ('member')),
  subject_id uuid not null,
  metric text not null check (metric in ('profile_views')),
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (subject_type, subject_id, metric, day)
);
-- Service-role only (no policies): stats aren't public data.
alter table public.daily_stats enable row level security;

-- One profile view (POST /v1/members/:slug/views): +1 to today's (UTC) counter. Only active
-- profiles count; a member opening their own profile doesn't.
create or replace function public.record_member_profile_view(p_slug text, p_viewer_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_member_id uuid;
begin
  select profile_id into v_member_id from public.member_profiles where slug = p_slug and status = 'active';
  if v_member_id is null or v_member_id = p_viewer_id then return false; end if;
  insert into public.daily_stats (subject_type, subject_id, metric, day, count)
  values ('member', v_member_id, 'profile_views', (now() at time zone 'utc')::date, 1)
  on conflict (subject_type, subject_id, metric, day) do update set count = daily_stats.count + 1;
  return true;
end $$;
revoke all on function public.record_member_profile_view(text, uuid) from public, anon, authenticated;
grant execute on function public.record_member_profile_view(text, uuid) to service_role;

commit;

-- Make the new table/function visible to the API (supabase-js / PostgREST) right away.
notify pgrst, 'reload schema';

-- Check afterwards (expect one row each):
-- select to_regclass('public.daily_stats');
-- select proname from pg_proc where proname = 'record_member_profile_view';
