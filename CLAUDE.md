# Expertly

Expertly is a membership platform connecting clients with vetted expert members (consultations,
peer-to-peer connect, articles, events, perks/templates/learnings, tiered membership & billing).
Three roles: `client` (public signup), `member` (vetted expert, application-gated), `admin`.

This repo (`expertly-website`) is the **implementation**: `frontend/` (Next.js App Router,
TypeScript, Tailwind) + `backend/` (NestJS). See root `README.md` for local dev / Docker / deploy.

## Design source of truth

The UI design lives in **`design/`** — a git submodule pointing at
`expertly-network/expertly-portal-design` (public repo). After cloning this repo, run
`git submodule update --init` (or clone with `--recurse-submodules`) to pull it in; it's pinned to
a specific commit, not auto-updating, so bump it deliberately (`cd design && git pull origin main`,
then commit the new pointer in `expertly-website`) when the design changes.

- **`design/static_html/*.html` + `design/static_html/assets/`** — pixel-level prototype of every
  page. When building a frontend route, check the matching `.html` file first for exact
  layout/copy/interaction before designing from scratch.
- **That's all it contains.** The design repo is UI-only by deliberate choice — no backend/schema
  docs belong there. It used to also hold a `database-erd.md`/`rest-api.md` pair; those were
  removed at the source (they'd gone stale relative to the actual prototype) and won't come back.
  **This repo now owns deriving and maintaining its own backend design** from what's actually in
  `design/static_html/`, not from any old written spec — see below.

## Architecture decisions already locked in

- **Auth: Supabase Auth (hybrid).** Supabase/GoTrue owns `auth.users`, credentials, sessions,
  OAuth. This repo owns exactly one extension table, `public.profiles` (role, name, avatar) — this
  part is already implemented (`supabase/migrations/0001_profiles_and_auth.sql`,
  `backend/src/auth/`), not something to re-derive. No custom `/auth/*` endpoints — the frontend
  calls `supabase-js` directly.
- **Role claim:** `app_role` is set via a Custom Access Token Hook / `profiles` lookup, never
  client-writable. Both frontend and backend verify the Supabase JWT locally (no per-request
  network/DB call) and read `app_role` off it for the common case, re-checking `profiles.role`
  fresh from the DB only for 🛡️ Admin routes and other destructive actions. **See
  [`docs/auth.md`](docs/auth.md) for the full flow, file map, and manual Supabase-dashboard
  steps** — read it before touching any auth-related code.
- **Backend (`backend/`, NestJS)** is a REST API layer in front of Postgres — the primary
  interface; Supabase's auto-generated PostgREST API is not exposed directly, and RLS is
  defense-in-depth rather than the main authorization mechanism.
- **Frontend (`frontend/`, Next.js)** implements the pages in `design/static_html/`, gates routes
  by role via middleware, and calls the NestJS API + `supabase-js`.

## Database schema & REST API — derive as you build, don't invent upfront

There is currently no standing ERD/API spec beyond the `profiles` table above. Rather than write
one large speculative document, derive each table/endpoint from `design/static_html/` at the point
a feature actually needs it — read every relevant page/script for that feature the way the old ERD
doc's own methodology described ("read every page/script, infer the real data model"), including
calling out where the prototype cuts corners (array-index mutation instead of stable ids, etc.)
rather than reproducing those shortcuts. Write the result into `docs/database-erd.md` /
`docs/rest-api.md` in **this** repo (create them on first use) and keep them current as each
feature lands, so the next feature builds on a real, accumulated spec instead of starting cold.

## When implementing a feature

1. Check `design/static_html/<page>.html` (+ its assets) for the UI to build.
2. Check whether `docs/database-erd.md` / `docs/rest-api.md` (this repo, not the design submodule)
   already cover the table(s)/endpoint(s) this feature needs. If not, derive them from the design
   now and add them — see above.
3. Flag anything the prototype leaves ambiguous (conflicting copy, no stated access rule, etc.)
   rather than guessing.
4. Need a new table/schema change? Two migration folders, split by whether the SQL touches
   Supabase's `auth.*` schema (`auth.users`, `auth.uid()`, Auth Hooks) — **`supabase/migrations/`**
   if yes, **`db/migrations/`** if no (plain Postgres, portable). Full test for which one in either
   folder's `README.md`.
