-- Expertly: profiles table + auth wiring
--
-- Extends Supabase Auth (auth.users) with the app's profiles table and role model.
-- See ../../CLAUDE.md and the design repo's docs/database-erd.md §3 for the full rationale.
--
-- Apply via the Supabase SQL Editor or `supabase db push`.

create extension if not exists citext;

create type profile_role as enum ('client', 'member', 'admin');
create type profile_status as enum ('active', 'suspended', 'deleted');

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
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index profiles_email_key on public.profiles (email);
create index profiles_role_idx on public.profiles (role);

-- Keep updated_at current on every row change.
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
-- becoming a 'member' only happens via an approved membership application (future
-- iteration); 'admin' is set directly by a super-admin/migration, never self-service.
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
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
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

-- RLS: defense in depth. Only a SELECT-own-row policy exists for now — this app has
-- no self-service profile-edit UI yet, and inserts only ever happen via the
-- `security definer` trigger above (which bypasses RLS by nature), so leaving writes
-- locked down is intentional, not an oversight.
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

-- Custom Access Token Hook: injects `app_role` into the JWT as a fast-path claim for
-- the future NestJS backend. Created here but INERT until manually registered in the
-- Supabase dashboard under Authentication -> Hooks -> "Custom Access Token" — that
-- registration step can't be done via SQL/CLI. Not depended on by this iteration's
-- frontend, which reads profiles.role directly instead (see lib/auth/profile.ts).
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
