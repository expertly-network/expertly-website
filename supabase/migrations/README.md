# Database migrations

Numbered sequentially, applied in order.

Applied manually (Supabase SQL Editor, or `supabase db push` if you adopt the Supabase CLI — this
folder's name/location already matches its expected convention) in filename order.

**From 2026-11-09 on, every schema change is a new, numbered migration.** Production went live on
2026-11-08; everything built up to and including that day is folded into `0001`–`0006`, which are
now the frozen go-live baseline and are **never edited again**. A change to tables, columns,
types, functions, policies or seed rows goes in the next file — `0007_<what_changed>.sql`,
`0008_…`, … — applied after the previous ones, on dev first and then production. Each migration:

- is **additive and safe on live data**: no drops or renames that existing code still reads
  (expand → migrate → contract across releases); a new `not null` column gets a default or a
  backfill in the same file; long-running changes avoid locking busy tables
  (`set lock_timeout = '5s'`; create big indexes `concurrently`, outside the transaction);
- runs in **one transaction** (`begin; … commit;`) unless a statement can't (`create index
  concurrently`), and is **idempotent** where practical (`if not exists`, `create or replace`,
  guarded `do $$ … $$` blocks) so a partial manual run can be re-run;
- ends with `notify pgrst, 'reload schema';` when it adds or changes anything the backend reaches
  through supabase-js (tables, functions) — PostgREST serves 500s for new objects until it reloads;
- updates `apps/backend/src/supabase/database.types.ts`, `docs/database-erd.md` and (if the
  contract changes) `docs/rest-api.md` / `packages/shared-types/` / the Postman collection in the
  same change.

Apply in the Supabase SQL editor (or `supabase db push` if the Supabase CLI is adopted — this
folder already follows its naming): **dev project first, verify, then production**, and only then
deploy the code that needs it. Record which numbered files each environment has run.

**How production reached the baseline.** Before go-live, changes were folded back into the
existing files (pre-production convention). Production — running the `2dcf1ee` images at go-live — was
brought up to the `0001`–`0006` baseline (as of `ae6c2a5`) once with
`supabase/catchup/2026-11-08-prod-2dcf1ee-to-baseline.sql` (idempotent, one transaction, guarded). New
environments are built from scratch instead (below), so that script is history, not a step.

**Baseline layout** (dependency order, not feature order):

1. `0001_extensions.sql` — Postgres extensions.
2. `0002_enums.sql` — every enum type, so later files can reference any of them.
3. `0003_functions.sql` — function bodies (trigger functions, the JWT hook). A function body
   doesn't need the tables/types it references to exist yet at `create function` time, which is
   what makes this ordering — functions before the tables they'll be attached to — valid.
4. `0004_tables.sql` — tables, indexes, trigger *attachments* (`create trigger ... execute
   function ...` — this does need its table to already exist), RLS, policies, seed data.

**AI search lives in the baseline files** (extensions in `0001`; functions in `0003` — wrapped in
`set check_function_bodies = off` because the `LANGUAGE sql` ones read tables that `0004`
creates later; tables, triggers, RLS and grants in `0004`). The browser roles (`anon`,
`authenticated`) get no table, sequence or function privileges at all except `select` on
`profiles` (own row via RLS) — see "Least privilege for the browser key" at the end of `0004`.

**Rebuilding a database from scratch** (fresh Supabase project): run `0001`–`0004`, then the
content seeds `0005`/`0006` (re-runnable — `on conflict (id) do nothing`), then every numbered
migration from `0007` up, in order; start the worker so it
builds the search cards and then embeds them (`pnpm worker`). Cards are derived data — nothing about
search needs to be restored from a dump. There are no dev-fixture seeds: everything in this folder
is safe to apply to production.

**Content seeds** (real launch content, not dev fixtures): `0005_seed_resources.sql` (perks,
learning videos, playlists, stacks) and `0006_seed_templates.sql` (templates, template kits).
Their image/document columns hold Storage object paths, so the public `resource-assets` and
private `template-files` buckets must be restored from a Storage backup (same object paths).

