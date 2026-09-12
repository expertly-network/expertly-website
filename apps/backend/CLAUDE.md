# Expertly backend (`apps/backend/`)

NestJS REST API in front of Postgres. This file covers conventions specific to working in this
app. Architecture-level rules (backend/frontend session split, schema-and-contract-derived-once
methodology, migration numbering) live in the **root `CLAUDE.md`** — read that first. This file
assumes it and only adds what's specific to writing backend code here.

## Module shape

One module per resource, mirroring `applications/`, `articles/`, `practice-areas/`:

```
<resource>/
  <resource>.module.ts       — imports AuthModule, wires controller + service + repository
  <resource>.controller.ts   — routes, auth/role decorators, nothing else
  <resource>.service.ts      — business logic, orchestration, DTO mapping — no Supabase calls
  <resource>.repository.ts   — every Supabase call for this resource, nothing else
  dto/
    create-<resource>.dto.ts
    update-<resource>.dto.ts
```

Keep the controller thin — request/response shape and auth annotations only. Business logic
(including the "computed fields never come from the client" rule below) belongs in the service.
The service never touches `SupabaseService` directly — every query or mutation is a named method
on that resource's repository (see "Data access" below).

## Auth on every route

Every route needs an explicit posture — there is no silent default. Use the decorators in
`auth/decorators/`:

- `@Public()` — no auth required (e.g. `GET /articles`, the published-only browse grid).
- No decorator — signed in, any role (e.g. reading a full article body).
- `@Roles('member')` — `RolesGuard` uses a ranked model, so `@Roles('member')` also admits
  `admin`; it's not an exact-match list. Don't add `'admin'` redundantly alongside `'member'`.
- `@CurrentUser()` — inject the authenticated user (id + role) into a handler; use it for
  ownership checks in the service, not the controller.

Comment routes with a short one-line 🌐/🔒/🔑/🛡️-style marker (see `articles.controller.ts` for
the pattern) stating who can hit it — this is what a reviewer (human or agent) checks first, and
it makes an accidental `@Public()` on something sensitive easy to spot.

## DTOs

`class-validator` decorators, one class per request shape, named `Create<Resource>Dto` /
`Update<Resource>Dto`. A field the client shouldn't control (server-derived excerpt, computed
read-time, anything set from `@CurrentUser()` rather than the body) simply isn't on the DTO — it's
computed in the service, never trusted from input even if the client happens to send it.

Validation `class-validator` can't express (word-count ranges, cross-field checks) goes in the
service with a comment saying so, not bolted onto the DTO with a custom decorator for a
one-call-site rule.

## Data access: repository is the only Supabase consumer, RLS is defense-in-depth

`<resource>.repository.ts` is the **only** place in a module that imports `SupabaseService` — one
method per query/mutation intent (e.g. `findLatestByApplicant`, not a generic `findOne(table)`),
each owning its own `if (error) throw new XException('...')`. Guards that need a fresh DB read
(`roles.guard.ts`, `admin-permission.guard.ts`) use `auth/profiles.repository.ts` the same way.
Services orchestrate repository calls and map rows to DTOs; they never call `.from(...)` or
`.storage` themselves.

Every table a repository touches gets a private accessor method (e.g. `private events() { return
this.supabase.db.from('events'); }`) — methods call `this.events()`, never
`this.supabase.db.from('events')` inline. One accessor per table, not per resource: a repository
spanning several tables (e.g. `MembersRepository` covering `member_profiles`,
`member_profile_edits`, `member_services`, ...) gets one accessor per table it touches.

Never `select('*')` or a bare `select()`. Every query names its columns via a `const
X_COLUMNS = [...] as const` colocated in the repository file, paired with a hand-written row
`interface` (not a class-validator DTO — those are for request bodies) instead of
`Record<string, any>`. One constant+interface pair per distinct query shape, not one per table —
a narrow list view and a full-detail load are different shapes even on the same table.

`src/supabase/database.types.ts` is generated (`pnpm gen:types`, see that script for the
`SUPABASE_DB_URL` it needs) from the live schema, never hand-edited, and `SupabaseService.db` is
typed as `SupabaseClient<Database>` — this catches a wrong table/column name in `.from()`,
`.eq()`, `.insert()`, `.update()` at compile time. It does not replace the column-list-plus-
interface pattern above: a `.select(COLUMNS.join(', '))` string is built at runtime, so Supabase's
type inference still can't parse it into a row shape — the hand-written interface is still what
the `as unknown as X` cast returns. Regenerate after any migration changes the schema.

The backend's Supabase client uses the service-role key, which bypasses RLS entirely. That's
intentional (see root CLAUDE.md and `docs/auth.md`): **RLS on every table is defense-in-depth, not
the enforcement mechanism** — this API's guards/decorators/service-layer ownership checks are.
Never reason "RLS will catch it" when writing a query here; write the `WHERE` clause / ownership
check as if RLS didn't exist, because for this client it doesn't.

For any array/JSONB column that references another table by id with no real FK (documented
per-column in `docs/database-erd.md` — `practice_area_ids`, `service_preferences`, etc.):
**validate every id against a live query before insert/update.** There is no CASCADE/RESTRICT
safety net on these; skipping the check is a data-integrity bug, not a shortcut.

## Verifying an endpoint

Per root CLAUDE.md, a backend session is verified standalone — curl or a REST client, no frontend
required. Type-check with `pnpm typecheck` or, if the workspace package manager is unavailable in
your environment, `./node_modules/.bin/tsc --noEmit` directly from this directory.
