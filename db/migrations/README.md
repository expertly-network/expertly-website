# Database migrations (provider-agnostic)

Plain Postgres migrations for this app's own tables — no dependency on Supabase Auth's schema or
functions. Would run unmodified against any Postgres (RDS, Neon, self-hosted, a different
Supabase project, etc).

Numbered sequentially, applied in order — same convention as `supabase/migrations/`.

**Currently empty.** Every table designed so far in `docs/database-erd.md` (once the design docs
are being read from, per `CLAUDE.md`) either extends `auth.users` directly or lives behind RLS
using `auth.uid()` — so it belongs in `../../supabase/migrations/`, not here. This folder exists
for the first table that doesn't need either.

## Which folder does a new migration go in?

Ask: does this migration reference `auth.*` (e.g. `auth.users`, `auth.uid()`) or a Supabase Auth
Hook signature anywhere in its SQL?

- **Yes** → `supabase/migrations/`. This includes anything with a trigger on `auth.users`, an RLS
  policy calling `auth.uid()`, or an Auth Hook function — even if unrelated tables in the same
  migration don't need it, keep the whole migration there rather than splitting one logical change
  across two folders.
- **No** → here. A table that has a foreign key to `public.profiles(id)` still qualifies — that's
  an ordinary FK to a table *we* own, not a Supabase-specific construct. `profiles` itself being
  Supabase-coupled doesn't make everything that references it coupled too.

**One refinement, learned from a real case:** this test is for where a table's migration *history*
starts, not a mechanical re-check on every later change to it. If a table already lives in
`supabase/migrations/` (because it was created there, possibly just bundled into the same logical
change as something that genuinely needed `auth.*`), a later migration that only alters *that*
table stays in the same folder — don't fragment one table's schema history across both folders just
because the alteration itself happens not to reference `auth.*`. Example:
`supabase/migrations/0003_practice_area_categories.sql` alters `practice_areas` (created in
`0002_membership_applications.sql`) and touches no `auth.*` at all, but stays in
`supabase/migrations/` rather than starting a new, confusingly-numbered `db/migrations/0001` for a
table that already exists elsewhere.

## Applying

No tooling wired up yet (no ORM, no migration runner) — same manual-apply convention as
`supabase/migrations/`: run the file's contents against Postgres directly (`psql`, or whichever
client) in filename order.
