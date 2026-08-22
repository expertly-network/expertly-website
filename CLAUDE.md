# Expertly

Expertly is a membership platform connecting clients with vetted expert members (consultations,
peer-to-peer connect, articles, events, perks/templates/learnings, tiered membership & billing).
Three roles: `client` (public signup), `member` (vetted expert, application-gated), `admin`.

This repo (`expertly-website`) is the **implementation**: `apps/frontend/` (Next.js App Router,
TypeScript, Tailwind) + `apps/backend/` (NestJS). See root `README.md` for local dev / Docker /
deploy.

## The three documents you must know

| File | What it contains | When to read it |
|---|---|---|
| `CLAUDE.md` (this file) | How to work in this codebase — architecture decisions, non-negotiable rules, session protocol | Every session, fully |
| `docs/master-tdd.md` | The map: what's built vs. schema-only vs. roadmap vs. beyond-roadmap, a routing table into the detail docs, build order | The relevant rows for today's task |
| `docs/user-stories.md` | What users need to accomplish, acceptance criteria per feature | The relevant stories for today's task |

`docs/master-tdd.md` doesn't duplicate detail — it routes you to `docs/database-erd.md`,
`docs/rest-api.md`, `docs/auth.md`, `docs/design-system.md`, and `docs/roadmap.md` for the actual
specs. Read master-tdd.md's Section 9 routing table first, then only the docs it points to.

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
  `apps/backend/src/auth/`), not something to re-derive. No custom `/auth/*` endpoints — the
  frontend calls `supabase-js` directly.
- **Role claim:** `app_role` is set via a Custom Access Token Hook / `profiles` lookup, never
  client-writable. Both frontend and backend verify the Supabase JWT locally (no per-request
  network/DB call) and read `app_role` off it for the common case, re-checking `profiles.role`
  fresh from the DB only for 🛡️ Admin routes and other destructive actions. **See
  [`docs/auth.md`](docs/auth.md) for the full flow, file map, and manual Supabase-dashboard
  steps** — read it before touching any auth-related code.
- **Backend (`apps/backend/`, NestJS)** is a REST API layer in front of Postgres — the primary
  interface; Supabase's auto-generated PostgREST API is not exposed directly, and RLS is
  defense-in-depth rather than the main authorization mechanism.
- **Frontend (`apps/frontend/`, Next.js)** implements the pages in `design/static_html/`, gates
  routes by role via middleware, and calls the NestJS API + `supabase-js`.
- **Tooling: pnpm workspace + Turborepo.** `apps/backend/`, `apps/frontend/`,
  `packages/shared-types/` are workspace members under one root `pnpm-lock.yaml` — install once at
  the repo root (`pnpm install`), not per folder. `pnpm dev` / `pnpm build` / `pnpm typecheck` run
  Turbo across all three; use `pnpm --filter ./apps/backend <script>` / `pnpm --filter
  ./apps/frontend <script>` to target just one.

## Database schema & REST API — a fixed contract, derived once per feature

`docs/database-erd.md` and `docs/rest-api.md` already exist and cover what's built so far (auth's
`profiles` table, practice areas, membership applications, articles, member directory & profiles —
see `docs/master-tdd.md` Section 3/6 for the current built-vs-planned map). The backend API is a
**fixed contract**: frontend adapts to it, not the other way around. A UI/visual change should
never require a backend change; only a genuinely new data requirement does, and that's a deliberate
decision, not something that happens silently mid-frontend-work.

This means backend and frontend for a new feature area are built in **separate sessions**, in
order:

1. **Backend session.** Read every relevant page/script in `design/static_html/` for that feature
   thoroughly — once, comprehensively — the way the old ERD doc's own methodology described ("read
   every page/script, infer the real data model"), including calling out where the prototype cuts
   corners (array-index mutation instead of stable ids, etc.) rather than reproducing those
   shortcuts. Derive the full schema and REST contract from that, write them into
   `docs/database-erd.md` / `docs/rest-api.md` in **this** repo (create on first use), implement
   and verify the backend (curl/REST client — no frontend needed to verify a contract). Base path
   `/v1`; additive changes (new optional field, new endpoint) don't need a version bump, anything
   actually breaking an existing shape goes to `/v2` rather than silently changing `/v1`. **Also**
   write the request/response interfaces into `packages/shared-types/<resource>.ts` (see its
   `README.md`) — this makes the contract compiler-enforced, not just documentation someone has to
   read carefully.
2. **Frontend session**, separate, implements pages against that now-fixed contract, importing
   types from `packages/shared-types/` (`import type` only — see that folder's `README.md` for
   why) instead of redefining its own copy. If it turns out the UI genuinely needs data the API
   doesn't provide, that's flagged back explicitly — "the contract needs to extend, here's why" —
   not patched in ad hoc from within the frontend session.

## When implementing a feature

1. Backend: check `design/static_html/<page>.html` (+ assets) for every field/operation the
   feature needs, derive the full schema + REST contract (§ above), implement, verify without a
   frontend.
2. Frontend (separate session): check `docs/database-erd.md` / `docs/rest-api.md` for the already-
   implemented contract and `design/static_html/<page>.html` for the UI — implement against the
   contract as given, don't modify it.
3. Flag anything the prototype leaves ambiguous (conflicting copy, no stated access rule, etc.)
   rather than guessing, in whichever session hits it.
4. Need a new table/schema change? It goes in **`supabase/migrations/`** — see that folder's
   `README.md` for the numbering/apply convention.

## Session protocol

### Step 1 — Identify what you're building
The user tells you the module/feature for this session. Look it up in `docs/master-tdd.md`
Section 9's routing table.

### Step 2 — Load only what's relevant
Don't read every doc in full every session — load the specific docs and user stories the routing
table points to for today's task.

### Step 3 — Confirm before writing code
After reading, state: what you're building (one sentence), the files you'll create/modify, any
dependencies that must exist first, and your implementation plan. Wait for confirmation before
writing code — this repo's own brainstorming/planning conventions (see any `superpowers` skills
available to you) apply on top of this, not instead of it.

### Step 4 — Validate against user stories
Before marking a feature done, check every acceptance criterion in the relevant
`docs/user-stories.md` section. If a criterion isn't met, fix it before declaring the feature done.
For 📋 Roadmap / 🔭 Beyond-roadmap stories, the criteria are a draft — validate the design against
the actual `design/static_html/*.html` page first (per the methodology above), update the story if
it was wrong, then implement against the corrected version.

### When you're unsure
1. Check `docs/master-tdd.md`'s routing table, then the doc(s) it points to.
2. Check `docs/user-stories.md`'s acceptance criteria for expected behavior.
3. If still unclear, ask one specific question before proceeding. Don't invent business rules or
   assume a shape that isn't documented anywhere.


## Non-Negotiable Rules

### Architecture
```
✅ TypeScript strict mode everywhere — no 'any', no exceptions
✅ NestJS backend uses Fastify adapter (not Express)
✅ All API responses go through ResponseInterceptor (envelope + camelCase)
✅ Frontend uses Next.js App Router with Server and Client Components
✅ All frontend API calls go through apiClient (never raw fetch)
✅ All database access from backend uses Supabase service role client
✅ Frontend never uses service role key — only anon key
```

### Database
```
✅ RLS is enabled on all tables — backend bypasses via service role key
✅ All mutations go through NestJS — never direct Supabase from frontend
✅ Slugs are always generated server-side — never client-side
```

**Not yet applicable:** no table has a vector/embedding column today — semantic/AI search is
explicitly not scoped (see `docs/master-tdd.md` Section 8.3). Don't add `vector(...)` columns or
call an embedding API speculatively. If that decision is ever made, the rule to reinstate is:
never `SELECT *` from a table that gains an embedding column, and use Google's `gemini-embedding-001`
(`outputDimensionality: 768`) via the v1beta REST API directly — not the `@google/generative-ai`
SDK, which doesn't support that model.

### Security
```
✅ SUPABASE_SERVICE_ROLE_KEY never in frontend code or .env.local
✅ No credentials hardcoded — all from process.env
✅ File uploads: always validate MIME type using file-type (magic bytes)
✅ Article HTML: always sanitise with sanitize-html before storing
```

**Not yet applicable:** AI-assisted article generation is explicitly deferred (nothing calls an LLM
today) — see `docs/rest-api.md`'s "not built yet" section. When it's built, apply prompt-injection
prevention on any user-supplied text fed to the model; there's no exact rule set yet because
there's no implementation to write one against.

### Error handling
```
✅ Every async function has explicit try/catch or throws typed exceptions
✅ Use NestJS HTTP exceptions with error codes, not generic Error
✅ Frontend reads error.code for specific user-facing messages
✅ Never use console.log — use NestJS Logger
```

---

## Code Quality Bar

Every piece of code must meet this standard before being considered done:

**Backend:**
- Controller has correct decorators (guards, roles, public)
- Service separates business logic from controller
- DTO has validation decorators matching the spec
- Error codes match the spec

**Frontend:**
- Server Components used for data fetching
- Client Components used for interactivity only
- Mobile-first responsive (check at 375px and 1440px)
- Loading states shown (skeleton or spinner)
- Error states handled (not just happy path)
- Empty states handled (list with no items)
- Uses `components/ui/*` base components (Button, Card, Input, Select, Textarea, Badge) — see
  `docs/design-system.md` before hand-rolling a new one
- Tailwind only — no custom CSS files
- Matches the design tokens in `docs/design-system.md` — no hardcoded hex values

**Not yet applicable:** there's no caching layer or ISR-revalidation endpoint built yet (no Redis,
no `/revalidate` route) and no email sending — don't add "invalidate cache" / "revalidate ISR" /
"send email" steps to a mutation until that infrastructure actually exists; note the gap instead
if a feature seems to need one of these.

**Design standard:** Linear, Vercel, Stripe — premium, clean,
generous whitespace. If it looks like a generic template, it is not done.

---

## Build order

Full detail and rationale: `docs/master-tdd.md` Section 10. Summary — already built: auth, practice
areas, membership applications, articles, member directory & profiles. Next, in order:
consultations → perks/templates/learnings → events → Peer Connect (its own dedicated scoping
session) → beyond-roadmap (notifications, admin/ops overview dashboard, search, renewal billing).

## Session closing checklist

At the end of any session touching backend or frontend:
```
□ List every file created or modified
□ State whether the relevant docs/user-stories.md acceptance criteria are met
□ Note any TODOs or explicitly deferred scope — name it, don't leave it silent
□ Confirm docs/rest-api.md / docs/database-erd.md / packages/shared-types/ were updated
  if the contract changed
□ Confirm no hardcoded credentials or keys
□ Confirm pnpm typecheck passes
```