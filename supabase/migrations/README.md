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
