# Database migrations

Numbered sequentially, applied in order.

Applied manually (Supabase SQL Editor, or `supabase db push` if you adopt the Supabase CLI — this
folder's name/location already matches its expected convention) in filename order.

**Pre-production, single-schema convention.** Until this project has a real production database
with real user data, the schema lives in four files, applied together in this order (dependency
order, not feature order):

1. `0001_extensions.sql` — Postgres extensions.
2. `0002_enums.sql` — every enum type, so later files can reference any of them.
3. `0003_functions.sql` — function bodies (trigger functions, the JWT hook). A function body
   doesn't need the tables/types it references to exist yet at `create function` time, which is
   what makes this ordering — functions before the tables they'll be attached to — valid.
4. `0004_tables.sql` — tables, indexes, trigger *attachments* (`create trigger ... execute
   function ...` — this does need its table to already exist), RLS, policies, seed data.

Every schema change gets folded back into these four files instead of accumulating as `0005`,
`0006`, ... — together they're always the full, current, ground-truth schema, rebuildable from
scratch. The day this repo ships to production, that stops: from then on every change is a new,
additive, numbered migration, and these four files are never edited again.

**Patching a database built from an older version of these files.** Because changes are folded
back into `0001`–`0004` rather than appended, an already-running database doesn't pick them up by
itself. Each such change that matters for a live project (security, constraints, indexes) also ships
as an idempotent, dated script in `supabase/patches/` — run it once in the SQL Editor; a fresh
rebuild never needs it. Current: `2026-10-29_security_hardening.sql` (Storage policies/limits,
private `application-documents` bucket; then run
`apps/backend/scripts/migrate-application-documents.mjs` once).

**AI search lives in the same four files** (extensions in `0001`; functions in `0003` — wrapped in
`set check_function_bodies = off` because the `LANGUAGE sql` ones read tables that `0004`
creates later; tables, triggers, RLS and grants in `0004`). The browser roles (`anon`,
`authenticated`) get no table, sequence or function privileges at all except `select` on
`profiles` (own row via RLS) — see "Least privilege for the browser key" at the end of `0004`.

**Rebuilding a dev database from scratch** (fresh Supabase project): run `0001`–`0004`, then the
dev seeds in `../seed/dev/` in filename order (`01_members`, `02_events`, `03_articles` — the
seed inserts fire the search triggers, so the outbox fills itself), then `0008`/`0009`; start the
worker so it builds the cards and then embeds them (`pnpm worker`).

**Dev seeds live outside this folder on purpose** (`supabase/seed/dev/`, moved 2026-10-29). Anything
in `migrations/` is applied by `supabase db push` to whichever project is linked — production
included — and the dev seeds create 50 fake, publicly listed members and 34 fake events. Never
apply `seed/dev/` to production.
Cards are derived data — nothing about search needs to be restored from a dump.

**Content seeds** (real launch content, not dev fixtures): `0008_seed_resources.sql` (perks,
learning videos, playlists, stacks) and `0009_seed_templates.sql` (templates, template kits).
Their image/document columns hold Storage object paths, so the public `resource-assets` and
private `template-files` buckets must be restored from a Storage backup (same object paths).

