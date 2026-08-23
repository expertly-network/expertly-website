-- Expertly: all functions (and the grants tied to one of them). Trigger *attachments*
-- (`create trigger ... execute function ...`) live in 0004_tables.sql next to the table they
-- attach to — a trigger needs its table to already exist, but a function body does not need
-- the tables/types it references to exist yet at CREATE FUNCTION time, which is what makes this
-- functions-before-tables ordering possible. See 0001_extensions.sql's header for the four-file
-- split this belongs to.

-- Keep updated_at current on every row change, for every table that has one.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Every new auth.users row gets a matching profiles row. Always starts as 'client' — becoming a
-- 'member' only happens via an approved membership application (manual, admin-side); 'admin' is
-- set directly by a super-admin/migration, never self-service.
--
-- Fields filled here and why:
--   - email, first_name, last_name: from Supabase's own signup metadata. Reads both our own
--     signUp() keys (first_name/last_name) and the OIDC standard claim names LinkedIn's/Google's
--     integration actually populate (given_name/family_name), so every signup path works.
--   - role, status: left at their column defaults ('client'/'active') — every new signup starts
--     identical here regardless of path; nothing about signup itself justifies a different value.
--   - auth_provider: read from Supabase's own `raw_app_meta_data->>'provider'`, not guessed.
--     Matched against the known enum values explicitly (not a raw cast) so an unrecognized
--     provider value from Supabase can never raise an invalid-enum-input exception here and
--     roll back the whole signup — it just falls back to 'email'.
--   - last_login_at: set to signup time. There's no separate login-event tracking built yet, so
--     this is the first (and, until that's built, the only) truthful value for it — "created a
--     session" is what signing up actually did.
--   - consent: a hardcoded current terms/privacy version snapshot, same pattern as
--     membership_applications.terms_version_agreed/privacy_version_agreed — there's no real
--     versioning system yet, so '1.0'/'1.0' is the confirmed real current value, not a
--     placeholder. Bump both here (and reconsider this function) the day those documents change.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  provider public.auth_provider;
begin
  provider := case new.raw_app_meta_data ->> 'provider'
    when 'google' then 'google'
    when 'linkedin_oidc' then 'linkedin_oidc'
    else 'email'
  end;

  insert into public.profiles (
    id, email, first_name, last_name, auth_provider, last_login_at, consent
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'given_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data ->> 'family_name', ''),
    provider,
    now(),
    jsonb_build_object('termsVersion', '1.0', 'privacyVersion', '1.0', 'acceptedAt', now())
  );
  return new;
end;
$$;

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
