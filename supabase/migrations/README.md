# Supabase-coupled migrations

Migrations here reference `auth.*` (e.g. extend `auth.users`, use `auth.uid()` in an RLS policy,
or implement a Supabase Auth Hook) — they only run against a Supabase project, not plain Postgres.

For everything else — this app's own tables that don't touch Supabase's auth schema — see
[`../../db/migrations/`](../../db/migrations/), including the exact test for which folder a new
migration belongs in.

Applied manually (Supabase SQL Editor, or `supabase db push` if you adopt the Supabase CLI — this
folder's name/location already matches its expected convention) in filename order.
