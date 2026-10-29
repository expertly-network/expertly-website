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

update storage.buckets set file_size_limit = 5242880 where id = 'resource-assets';

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

-- ---- Least privilege for the browser key (anon / authenticated) ---------------------------
-- The frontend reads only its own profiles row directly; everything else goes through NestJS.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on table public.profiles to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

commit;
