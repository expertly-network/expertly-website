# Expertly — Authentication & Authorization Reference

Full reference for how auth actually works in this repo, kept separate from `CLAUDE.md` so that
file stays scannable as more features ship. Linked from `CLAUDE.md`'s architecture-decisions
section — read that first for the product/role model, this file for implementation detail.

## How authentication & authorization actually flow

Two separate, independent checks exist — neither trusts the other, both verify the same JWT
themselves:

1. **Page-level gating (Next.js only, no backend call).** Deciding whether a page renders at all
   — guest vs. signed-in, and eventually role-specific pages — happens entirely in
   `apps/frontend/middleware.ts` and each page's Server Component, by verifying the session JWT
   locally (`getSessionUser()`). The backend is never called just to load a page.
2. **API-level authorization (frontend → backend, per data call).** When a page needs data from
   the NestJS API, the frontend attaches the Supabase access token as `Authorization: Bearer
   <token>`. The backend independently re-verifies that same token (`SupabaseAuthGuard`) and
   authorizes the specific endpoint by role (`RolesGuard`) — it does not trust that the frontend
   already checked anything.

**Where the token lives:** Supabase session (access + refresh token) is stored in **cookies** via
`@supabase/ssr` — not `localStorage`. This is deliberate: plain `supabase-js` defaults to
`localStorage`, which only client-side browser JS can read; cookies are what let `middleware.ts`
and Server Components (server-side) see the session too.

**Current state vs. the target pattern** (don't mistake one for the other):
- Frontend: `/dashboard` today only checks "is anyone signed in" — any role passes, it just
  renders different text per role. No role-*restricted* page exists yet. When one is needed, gate
  it the same way `/dashboard` gates on auth: `const profile = await getSessionUser(); if
  (profile?.role !== 'admin') redirect('/')`. Worth extracting into a `requireRole()` helper once
  a second page needs the same check — not built speculatively ahead of that.
- Backend: guards are built and tested (see below) but **no page currently calls the backend for
  data** — nothing sends a bearer token yet in practice. Once a real endpoint is built, shaping the
  *response* by role (e.g. `rest-api.md`'s `GET /articles/{slug}` — full `body` for 🔑 Auth
  callers, omitted for 🌐 anonymous ones, same route) is just ordinary handler logic using
  `@CurrentUser()`'s already-resolved `role` — no new auth plumbing required.

## Auth implementation (shipped) — frontend

Login/Sign Up is implemented in `apps/frontend/` against Supabase Auth directly (no backend
involvement yet — the NestJS backend only enters the picture once it starts serving its own
endpoints per `rest-api.md`). Key pieces, so later page-by-page work doesn't rediscover this:

- **`supabase/migrations/0001_profiles_and_auth.sql`** (repo root) — `profiles` table,
  `handle_new_user`/`on_auth_user_updated` triggers, RLS (SELECT-own-row only — no self-service
  profile editing yet), and the `custom_access_token_hook` function. **Must be applied manually**
  to the Supabase project (SQL Editor or `supabase db push`) — not run automatically.
- **Manual Supabase-dashboard steps** (not scriptable, easy to forget): enable the LinkedIn (OIDC)
  provider under Authentication → Providers; add `/auth/callback` to Authentication → URL
  Configuration → Redirect Values for every environment; **register
  `custom_access_token_hook`** under Authentication → Hooks → "Customize Access Token (JWT)
  Claims" — **this one is depended on now** (see below), not optional.
- **Role/session reads are claim-based, not DB-based**: `apps/frontend/lib/auth/session-claims.ts`'s
  `getSessionUser()` reads the session cookie and verifies the JWT's signature against the
  project's JWKS (`lib/auth/verify-token.ts`, `jose`'s `createRemoteJWKSet` — public keys fetched
  once and cached, not a shared secret; see that file's comments for why a shared-secret HS256
  check doesn't work here — this project signs tokens with ES256) — no network call per request,
  no DB query — taking `role` off the `app_role` claim and name off Supabase's built-in
  `user_metadata` claim. This is
  what nav rendering (`TopNav`), `/login`'s already-signed-in redirect, and `/dashboard` all use.
  Missing/unrecognized `app_role` (hook not yet registered, or a token minted before it was)
  safely defaults to `client` — fails closed. `lib/auth/profile.ts`'s `getCurrentProfile()` is the
  other tier — always DB-fresh, kept for a future page that genuinely needs guaranteed-current
  data rather than accepting up to ~1hr of claim staleness (mirrors the backend's admin
  fresh-check). Neither one talks to the backend API.
- **One combined `/login` page** (`apps/frontend/app/login/`, `components/auth/AuthCard.tsx`) with
  User/Member tabs, matching the design mockup. User tab: first/last name + email + password +
  a single "Continue" button that auto-detects login-vs-signup (tries sign-in, falls back to
  sign-up only on `invalid_credentials` — see `lib/auth/continue-with-email.ts` for the full
  branch logic and why `identities:[]`/`user_already_exists` mean "already registered"). Member
  tab: LinkedIn OAuth only, no password field (members have no password — provisioning happens
  via the not-yet-built membership-application approval flow). Google OAuth is intentionally not
  wired up (design's own JS hides it regardless of tab); LinkedIn is (`lib/auth/linkedin.ts` +
  `app/auth/callback/route.ts`, a PKCE code-exchange route required by `@supabase/ssr`).
- **Session/route protection**: `apps/frontend/middleware.ts` (session refresh + redirects signed-out
  users away from protected prefixes — currently just `/dashboard`) using
  `apps/frontend/lib/supabase/{client,server,middleware}.ts` (`@supabase/ssr`, cookie-based session,
  `getUser()` not `getSession()` for verified checks). `apps/frontend/app/dashboard/` is the one
  protected placeholder page so far, rendering differently per role.
- **Design tokens**: ported from the design repo's `theme.css` default palette into CSS custom
  properties in `apps/frontend/app/globals.css`, mapped into `tailwind.config.ts` (`bg-accent`,
  `text-ink-3`, etc.). Fonts: Geist (`geist` npm package, not Google Fonts) + Archivo
  (`next/font/google`).
- **Not built yet**: the marketing homepage content, every other nav destination (Articles,
  Events, Members, Membership…), and the membership-application/admin-approval flow that actually
  creates `member` accounts — build these page-by-page per the design, wiring each into
  `apps/frontend/components/nav/TopNav.tsx`'s role branches as they ship.

## Backend authorization (shipped)

`apps/backend/src/auth/` implements the server-side half of rest-api.md §1/§6's access-level model
(🌐 Public / 🔑 Auth / 👤 Member / 🛡️ Admin / 🔒 Owner):

- **`SupabaseAuthGuard`** (`guards/supabase-auth.guard.ts`) is registered **globally** via
  `APP_GUARD` in `auth.module.ts` — every route requires a valid `Authorization: Bearer
  <supabase_access_token>` header unless decorated `@Public()`. It verifies the token's signature
  against the project's JWKS (`verify-token.ts`, `jose`'s `createRemoteJWKSet`, cached — not a
  shared secret) — no network call to Supabase Auth, no DB query — and reads `role` off the
  `app_role` claim (set by the Custom Access Token
  Hook — **must be registered in the dashboard**, see "Auth implementation" above) and name off
  `user_metadata`, attaching the result as `request.user`. Missing/unrecognized `app_role` defaults
  to `client` (fails closed).
- This trades some staleness (a role change takes effect up to ~1hr later, whenever the token next
  refreshes) for zero per-request I/O. That's fine for `client`/`member` routes; it is **not**
  fine for `admin` — a just-revoked admin's still-valid token would otherwise keep working for up
  to an hour. `RolesGuard` compensates: when `@Roles('admin')` is required (and only then, and
  only after the rank check already passed — a stale claim that looks under-privileged is denied
  outright, never fresh-checked), it re-queries `profiles.role`/`status` via the **service-role**
  Supabase client (bypasses RLS — the ERD's "connects to Postgres with a service_role key" piece)
  before granting access. For "revoke this user's access right now" (e.g. a suspension), use
  Supabase Auth's Admin API to force-expire their session rather than adding a DB check to every
  request — rest-api.md's `POST /admin/members/{id}/revoke-sessions` already does this.
- **`RolesGuard`** (`guards/roles.guard.ts`) is also global, but only acts on routes carrying
  `@Roles('member' | 'admin')` metadata; runs after `SupabaseAuthGuard` (registration order in
  `auth.module.ts` matters) so `request.user.role` is already populated. Roles are ranked
  (`types/auth.types.ts`'s `ROLE_RANK`) so `admin` satisfies an `@Roles('member')` check —
  **`@Roles()` always means "this role or higher," never "exactly this role."** For an endpoint
  that must reject even higher-ranked roles (e.g. `POST /v1/applications` — a `member`/`admin`
  re-applying makes no sense and must be `403`, not silently allowed), don't reach for `@Roles()`;
  do an explicit `user.role !== 'x'` check in the service instead. Real example:
  `apps/backend/src/applications/applications.service.ts`'s `create()`. Note the ordering consequence:
  that check runs inside the controller method, which only executes after `ValidationPipe` accepts
  the request body — so a wrong-role caller sending a malformed body gets `400`, not `403`. Both
  correctly reject the request; don't rely on `403` specifically from a body that's also invalid.
- **`@Public()`**, **`@Roles(...)`**, **`@CurrentUser()`** decorators in `auth/decorators/` — use
  these on every new controller. No route should manually re-check bearer tokens.
- **🔒 Owner** scoping (e.g. "can only edit your own profile") has no generic guard — it's a
  per-endpoint comparison of `req.user.id` against the resource's owner id, checked in application
  code. No such endpoint exists yet; follow this convention when one does.
- `apps/backend/src/auth/auth.controller.ts` has three smoke-test routes proving each level:
  `GET /me` (🔑 Auth), `GET /member/ping` (👤 Member), `GET /admin/ping` (🛡️ Admin). Replace/extend
  with real endpoints as rest-api.md's actual routes get built; keep the guard/decorator pattern.
- Needs `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `apps/backend/.env` (the service role key is
  backend-only — never expose it to the frontend). No separate JWT secret needed — verification
  uses the project's public JWKS, derived from `SUPABASE_URL` alone. The app fails fast on boot if
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are missing (via `SupabaseService`'s constructor).
