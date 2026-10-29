-- ============================================================================
-- 2026-10-29 security & performance hardening — for an EXISTING database.
--
-- supabase/migrations/0001–0004 are the ground-truth schema (pre-production convention, see
-- supabase/migrations/README.md) and already contain everything below, so a fresh rebuild needs
-- nothing from this file. A database built from an earlier version of those files does: run this
-- once in the SQL Editor. Every statement is idempotent — safe to re-run.
--
-- After running it: `node --env-file=.env scripts/migrate-application-documents.mjs` (from
-- apps/backend) moves already-uploaded vetting documents out of the public bucket.
-- ============================================================================

begin;

-- Fail fast instead of queueing behind a long transaction (and stalling logins, which read
-- profiles/member_profiles in the token hook) — just re-run it later.
set local lock_timeout = '5s';

-- ---- Storage: no direct client writes; size + type limits on every bucket ----------------

drop policy if exists member_proofs_owner_rw on storage.objects;
drop policy if exists ai_draft_sources_owner_rw on storage.objects;
drop policy if exists application_assets_owner_all on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-documents', 'application-documents', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'member-proofs';

update storage.buckets set file_size_limit = 15728640 where id = 'ai-draft-sources';

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'application-assets';

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
 where id = 'resource-assets';

update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array['application/pdf',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                  'application/vnd.openxmlformats-officedocument.presentationml.presentation']
 where id = 'template-files';

-- ---- Token claims: account + member status (custom_access_token_hook) ---------------------

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb;
  user_role text;
  user_status text;
  member_status text;
begin
  select p.role::text, p.status::text, mp.status::text
    into user_role, user_status, member_status
    from public.profiles p
    left join public.member_profiles mp on mp.profile_id = p.id
   where p.id = (event ->> 'user_id')::uuid;
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{app_role}', to_jsonb(coalesce(user_role, 'client')));
  claims := jsonb_set(claims, '{app_status}', to_jsonb(coalesce(user_status, 'active')));
  claims := jsonb_set(claims, '{app_member_status}', coalesce(to_jsonb(member_status), 'null'::jsonb));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant select (profile_id, status) on table public.member_profiles to supabase_auth_admin;
drop policy if exists member_profiles_select_auth_admin on public.member_profiles;
create policy member_profiles_select_auth_admin
  on public.member_profiles for select
  to supabase_auth_admin
  using (true);

-- ---- Member directory: filtering/search/sort/paging in SQL (GET /v1/members) --------------

create or replace function public.member_directory_ids(
  p_q text default null,
  p_service_ids uuid[] default null,
  p_category_id uuid default null,
  p_countries text[] default null,
  p_rate_min_cents integer default null,
  p_rate_max_cents integer default null,
  p_sort text default null,
  p_limit integer default 8,
  p_offset integer default 0
)
returns table (profile_id uuid)
language sql
stable
set search_path = public
as $$
  with term as (
    select nullif(btrim(p_q), '') as raw,
           '%' || replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
           array_remove(string_to_array(lower(btrim(coalesce(p_q, ''))), ' '), '') as words
  ),
  text_services as (
    select s.id
      from services s
      join categories c on c.id = s.category_id, term
     where term.raw is not null
       and (s.name ilike term.pattern or c.name ilike term.pattern)
  )
  select mp.profile_id
    from member_profiles mp
    join profiles p on p.id = mp.profile_id, term
   where mp.status = 'active'
     and p.status = 'active' and p.deleted_at is null   -- suspended/deleted accounts are never listed
     and (coalesce(cardinality(p_countries), 0) = 0 or mp.country = any(p_countries))
     and (p_rate_min_cents is null or mp.rate_max_cents >= p_rate_min_cents)
     and (p_rate_max_cents is null or mp.rate_min_cents <= p_rate_max_cents)
     and (
       coalesce(cardinality(p_service_ids), 0) = 0
       or exists (select 1 from member_services ms
                   where ms.member_id = mp.profile_id and ms.service_id = any(p_service_ids))
     )
     and (
       p_category_id is null
       or exists (select 1 from member_services ms join services s on s.id = ms.service_id
                   where ms.member_id = mp.profile_id and s.category_id = p_category_id)
     )
     and (
       term.raw is null
       or mp.headline ilike term.pattern or mp.firm_name ilike term.pattern or mp.bio ilike term.pattern
       or mp.city ilike term.pattern or mp.state ilike term.pattern or mp.country ilike term.pattern
       or not exists (
         select 1 from unnest(term.words) w
          where position(w in lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) = 0
       )
       or exists (select 1 from member_services ms
                   where ms.member_id = mp.profile_id and ms.service_id in (select id from text_services))
     )
   order by
     case when p_sort = 'newest' then mp.membership_started_at end desc nulls last,
     case when p_sort = 'tenure' then mp.years_of_experience end desc nulls last,
     case when p_sort = 'rate_asc' then mp.rate_min_cents end asc nulls first,
     case when p_sort = 'rate_desc' then mp.rate_max_cents end desc nulls last,
     case when p_sort is null or p_sort not in ('newest', 'tenure', 'rate_asc', 'rate_desc') then mp.is_verified end desc,
     case when p_sort is null or p_sort not in ('newest', 'tenure', 'rate_asc', 'rate_desc') then mp.created_at end desc,
     mp.profile_id
   limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.member_directory_ids(text, uuid[], uuid, text[], integer, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.member_directory_ids(text, uuid[], uuid, text[], integer, integer, text, integer, integer)
  to service_role;

-- ---- Indexes matched to the API's list queries --------------------------------------------

drop index if exists public.membership_applications_applicant_id_idx;
create index membership_applications_applicant_id_idx on public.membership_applications (applicant_id, created_at desc);
create index if not exists membership_applications_created_at_idx on public.membership_applications (created_at desc);
create index if not exists membership_applications_reviewed_by_idx on public.membership_applications (reviewed_by);
drop index if exists public.articles_author_id_idx;
create index articles_author_id_idx on public.articles (author_id, created_at desc);
drop index if exists public.articles_status_idx;
create index if not exists articles_status_created_idx on public.articles (status, created_at desc, id);
drop index if exists public.events_status_idx;
create index if not exists events_status_start_idx on public.events (status, start_date);
drop index if exists public.consultation_requests_requester_id_idx;
create index consultation_requests_requester_id_idx on public.consultation_requests (requester_id, created_at desc);
drop index if exists public.consultation_requests_member_id_idx;
create index consultation_requests_member_id_idx on public.consultation_requests (member_id, created_at desc);
create index if not exists consultation_requests_created_at_idx on public.consultation_requests (created_at desc);
create index if not exists consultation_messages_sender_id_idx on public.consultation_messages (sender_id);
drop index if exists public.member_profiles_status_idx;
create index member_profiles_status_idx on public.member_profiles (status, is_verified desc, created_at desc);
create index if not exists member_profiles_application_id_idx on public.member_profiles (application_id);
drop index if exists public.member_profile_edits_member_id_idx;
create index member_profile_edits_member_id_idx on public.member_profile_edits (member_id, submitted_at desc);
drop index if exists public.member_profile_edits_status_idx;
create index member_profile_edits_status_idx on public.member_profile_edits (status, submitted_at desc);
create index if not exists member_profile_edits_reviewed_by_idx on public.member_profile_edits (reviewed_by);
drop index if exists public.member_recommendations_recipient_id_idx;
create index member_recommendations_recipient_id_idx on public.member_recommendations (recipient_id, created_at desc);
create index if not exists search_documents_source_id_idx on public.search_documents (source_id);

-- ---- Integrity -----------------------------------------------------------------------------

-- One open application per applicant — skipped (with a notice) if duplicates already exist;
-- resolve those by hand, then re-run this file.
do $$
begin
  if exists (
    select 1 from public.membership_applications
     where status in ('draft', 'submitted', 'under_review')
     group by applicant_id having count(*) > 1
  ) then
    raise notice 'membership_applications has applicants with several open applications — unique index NOT created';
  else
    create unique index if not exists membership_applications_one_open_per_applicant
      on public.membership_applications (applicant_id)
      where status in ('draft', 'submitted', 'under_review');
  end if;
end $$;

-- Deleting an admin who reviewed something no longer fails on these references.
alter table public.membership_applications drop constraint if exists membership_applications_reviewed_by_fkey;
alter table public.membership_applications add constraint membership_applications_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles (id) on delete set null;
alter table public.member_profile_edits drop constraint if exists member_profile_edits_reviewed_by_fkey;
alter table public.member_profile_edits add constraint member_profile_edits_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles (id) on delete set null;
alter table public.peer_connect_matches drop constraint if exists peer_connect_matches_reschedule_requested_by_fkey;
alter table public.peer_connect_matches add constraint peer_connect_matches_reschedule_requested_by_fkey
  foreign key (reschedule_requested_by) references public.profiles (id) on delete set null;
alter table public.member_profiles drop constraint if exists member_profiles_application_id_fkey;
alter table public.member_profiles add constraint member_profiles_application_id_fkey
  foreign key (application_id) references public.membership_applications (id) on delete set null;

-- NOT VALID: enforced for every new/updated row without failing on rows that already exist.
-- Added only when missing, so a re-run never downgrades a constraint that's since been validated.
-- Once existing data is checked, `alter table … validate constraint …` makes them full checks.
do $$
declare c record;
begin
  for c in select * from (values
    ('profiles', 'profiles_admin_role_only_for_admins', 'check (admin_role is null or role = ''admin'')'),
    ('events', 'events_end_after_start', 'check (end_date is null or end_date >= start_date)'),
    ('consultation_requests', 'consultation_requests_not_self', 'check (requester_id <> member_id)'),
    ('peer_connect_matches', 'peer_connect_matches_end_after_start', 'check (scheduled_end_at > scheduled_start_at)')
  ) as t(tbl, name, def)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table public.%I add constraint %I %s not valid', c.tbl, c.name, c.def);
    end if;
  end loop;
end $$;

-- ---- Least privilege for the browser key (anon / authenticated) ---------------------------
-- The frontend reads only its own profiles row directly; everything else goes through NestJS.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- App functions only: extension-owned functions (citext, pgvector operators) keep their grants —
-- revoking those from PUBLIC would break the service role's own queries on citext/vector columns
-- wherever it relies on PUBLIC rather than an explicit grant.
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end $$;
-- The backend's role keeps everything, explicitly (it bypasses RLS and is fully trusted anyway).
grant execute on all functions in schema public to service_role;

grant select on table public.profiles to authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
-- PUBLIC's EXECUTE default is global, so it can only be revoked globally (a per-schema REVOKE is
-- a no-op for it); anon/authenticated get theirs from Supabase's per-schema defaults.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

-- ---- Re-index member search cards --------------------------------------------------------
-- Card text no longer includes private proof data (apps/backend/src/search/card-text.ts);
-- queue every member so the worker rebuilds (and re-embeds) their card without it.
select public.search_enqueue('member', profile_id) from public.member_profiles;

commit;
