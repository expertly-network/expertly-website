-- Bug fix: handle_new_user() only read raw_user_meta_data's first_name/
-- last_name keys — correct for our own email/password signUp() call (which
-- passes exactly those keys via options.data), but LinkedIn OAuth users
-- never have them. Supabase's LinkedIn OIDC integration populates
-- given_name/family_name instead (the actual OIDC standard claim names),
-- so every real LinkedIn signup got empty name fields, silently. Only
-- discovered because a real LinkedIn-signed-up test user existed to check
-- against — the original migration's own testing only used hand-crafted
-- metadata containing first_name/last_name, which never exercised this path.
--
-- Lives here (continuing supabase/migrations/ numbering, not db/migrations/)
-- per the same rule as 0003 — this alters a function auth.users itself
-- triggers, originally defined in 0001.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'given_name',
      ''
    ),
    coalesce(
      new.raw_user_meta_data ->> 'last_name',
      new.raw_user_meta_data ->> 'family_name',
      ''
    ),
    'client'
  );
  return new;
end;
$$;
