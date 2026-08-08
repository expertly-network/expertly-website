# Expertly

Expertly is a membership platform connecting clients with vetted expert members (consultations,
peer-to-peer connect, articles, events, perks/templates/learnings, tiered membership & billing).
Three roles: `client` (public signup), `member` (vetted expert, application-gated), `admin`.

This repo (`expertly-website`) is the **implementation**: `frontend/` (Next.js App Router,
TypeScript, Tailwind) + `backend/` (NestJS). See root `README.md` for local dev / Docker / deploy.

## Design source of truth

The product design is finalized in a sibling repo:

```
/Users/shreyans/Personal/Projects/expertly-design-claude/expertly_design/
```

(GitHub: `expertly-network/expertly-portal-design`, kept separate from this repo — read from it,
don't copy its files in here.)

- **`static_html/*.html` + `static_html/assets/`** — pixel-level prototype of every page
  (login, apply, onboarding_form, dashboard + dashboard-alt-3, admin-dashboard, member-profile,
  members, articles/article, events, membership, perks, templates, learnings, my-consultations,
  consultation-requests, peer-connect, review). When building a frontend route, check the matching
  `.html` file first for exact layout/copy/interaction before designing from scratch.
- **`docs/database-erd.md`** — full Postgres schema (profiles, membership_applications,
  member_profiles + sub-tables, consultation_requests, peer_connect_*, articles, events,
  perks/templates/courses, membership_tiers/member_subscriptions, notifications, activity_log),
  with inline "Design decision" callouts explaining non-obvious choices.
- **`docs/rest-api.md`** — full endpoint spec (companion to the ERD; every endpoint maps to tables
  there), including the public/auth/member/admin/owner access-level convention used throughout.

## Architecture decisions already locked in by the design docs

- **Auth: Supabase Auth (hybrid).** Supabase/GoTrue owns `auth.users`, credentials, sessions,
  OAuth. This repo owns exactly one extension table, `public.profiles` (role, name, avatar). No
  custom `/auth/*` endpoints — the frontend calls `supabase-js` directly; see rest-api.md §2's
  mapping table from old custom endpoints to `supabase.auth.*` calls.
- **Role claim:** `app_role` is set via a Custom Access Token Hook / `profiles` lookup (ERD §3),
  never client-writable. Both frontend and backend verify the Supabase JWT locally (no per-request
  network/DB call) and read `app_role` off it for the common case, re-checking `profiles.role`
  fresh from the DB only for 🛡️ Admin routes and other destructive actions. **See
  [`docs/auth.md`](docs/auth.md) for the full flow, file map, and manual Supabase-dashboard
  steps** — read it before touching any auth-related code.
- **Backend (`backend/`, NestJS)** implements `docs/rest-api.md` as a REST API layer in front of
  Postgres — it is the primary interface; Supabase's auto-generated PostgREST API is not exposed
  directly, and RLS is defense-in-depth rather than the main authorization mechanism.
- **Frontend (`frontend/`, Next.js)** implements the pages in `static_html/`, gates routes by
  `app_role` (client/member/admin) via middleware, and calls the NestJS API + `supabase-js`.

## When implementing a feature

1. Check `static_html/<page>.html` (+ its assets) for the UI to build.
2. Check `docs/rest-api.md` for the endpoint(s) it needs and their access level.
3. Check `docs/database-erd.md` for the underlying table(s).
4. Check `docs/database-erd.md` §14 "Open questions for product" — if the feature touches one of
   those, flag it rather than guessing.
5. Need a new table/schema change? Two migration folders, split by whether the SQL touches
   Supabase's `auth.*` schema (`auth.users`, `auth.uid()`, Auth Hooks) — **`supabase/migrations/`**
   if yes, **`db/migrations/`** if no (plain Postgres, portable). Full test for which one in either
   folder's `README.md`.
