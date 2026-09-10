# Backend Controller/Service/Repository Layering — Design Spec

**Status:** Approved — implementing in this session.
**Scope:** Backend only, all resource modules. No behavior change intended — this is a structural
extraction, not a feature. No shared-types / REST contract changes (request/response shapes are
unaffected).

## 1. Current state

- `apps/backend/CLAUDE.md`'s documented module shape is `<resource>.module.ts` /
  `<resource>.controller.ts` / `<resource>.service.ts` / `dto/` — two layers only. Services call
  `SupabaseService.db` directly, mixing business logic with raw Supabase queries in the same
  methods.
- Direct `SupabaseService.db` usage exists in: `applications/applications.service.ts` (17 calls,
  incl. storage), `members/members.service.ts` (19), `articles/articles.service.ts` (14),
  `events/events.service.ts` (8), `practice-areas/practice-areas.service.ts` (1), and two auth
  guards — `auth/guards/roles.guard.ts` and `auth/guards/admin-permission.guard.ts` — which each
  inline a `profiles` table lookup for their fresh-read re-check.
- `ai/ai.service.ts` and `ai/unsplash.service.ts` have no direct Supabase table access (ai composes
  other services; unsplash calls an external HTTP API) — out of scope.
- Rows are typed as `Record<string, any>` (or untyped) everywhere; queries frequently use
  `select('*')` or a bare `select()` for "give me the full row," and even the already-narrow
  selects (e.g. `ApplicationsService.listForReview`) are inline strings, not named.
- No generated Supabase `Database` type exists in this stack (`createClient` isn't parameterized
  with one) — confirmed via search. Bringing that in is a separate, larger decision and is
  explicitly **not** part of this spec.
- No backend test suite exists (no `*.spec.ts`, no `test` script) — verification here follows this
  repo's existing documented convention: typecheck + curl/REST-client spot checks, no frontend
  required.

## 2. What this spec adds

### 2.1 Repository layer, one per resource module

New `<resource>.repository.ts` in each of: `applications/`, `articles/`, `events/`, `members/`,
`practice-areas/`. Plus `auth/profiles.repository.ts`, shared by both guards.

- `@Injectable()`, constructor takes `SupabaseService` — it becomes the **only** consumer of
  `SupabaseService` in its module; the service no longer imports it.
- One method per query/mutation **intent** (e.g. `findLatestByApplicant`, `updateById`,
  `insertDraft`, `uploadFile`, `signedUrl`), not one generic per-table method.
- Each method contains the Supabase call **and** the exact `if (error) throw new
  XException('message')` currently inline at that call site — a mechanical move preserving today's
  exact error type and message, not a rewrite. No new generic wrapping/error-translation layer.
- Storage calls (`.storage.from(...).upload` / `.createSignedUrl`) move into the repository
  alongside table calls — same client, same principle.
- Not exported from its module unless a second module needs it. Today only `ProfilesRepository`
  needs cross-consumer access (both guards, `auth.module.ts` exports it); no other repository is
  exported.

### 2.2 Explicit column lists, no `select('*')`

Every `select('*')`, bare `select()`, and existing inline narrow-select string is replaced with a
named constant colocated in the repository file:

```ts
const APPLICATION_ROW_COLUMNS = [
  'id', 'status', 'applicant_id', 'first_name', 'last_name', /* …every field toDto() reads */
] as const;

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  applicant_id: string;
  first_name: string | null;
  // …one field per entry above, properly typed instead of `any`
}
```

- One constant + interface pair **per distinct query shape**, not one per table — e.g.
  `ApplicationRow`/`APPLICATION_ROW_COLUMNS` for full loads is separate from the narrower shape
  `listForReview` already selects.
- `.select(APPLICATION_ROW_COLUMNS.join(', '))` replaces the `'*'`/bare call.
- This is **not** a class-validator DTO (those validate incoming request bodies —
  `Create<Resource>Dto` etc.) — plain `const … as const` + `interface`, named without a `Dto`
  suffix to avoid confusion with that existing convention.
- The array and the interface are two hand-maintained artifacts kept in sync by a reviewer diffing
  them side by side — there is no compiler-enforced 1:1 link between them without Supabase-generated
  DB types, which this spec deliberately does not introduce (see §1). Noted as a possible future
  improvement, out of scope here.

### 2.3 Service layer unchanged in responsibility

Services keep 100% of their current business logic, orchestration across multiple repository
calls, validation, and DTO mapping (snake_case row → camelCase `*Dto`). Only the data-access lines
move out; control flow and every thrown exception's type/message stay put (now often thrown from
inside the repository method the service calls, not inline in the service).

### 2.4 Guards

`ProfilesRepository.getRoleAndAdminRole(userId)` (or equivalent) replaces the inline
`.from('profiles').select('role, admin_role').eq('id', userId).single()` in both
`roles.guard.ts` and `admin-permission.guard.ts`. Each guard keeps its own
error-to-`ForbiddenException` mapping locally in the guard — that fail-closed semantic is
guard-specific and doesn't belong in a shared repository.

### 2.5 Docs updated

- `apps/backend/CLAUDE.md` "Module shape" gets a `<resource>.repository.ts` line.
- Its "Data access" section is updated to state repositories are the only place `SupabaseService`
  is injected, and to describe the named-column-constant convention (no `select('*')`).

## 3. Explicitly out of scope

- **Layer-based top-level folders** (`controllers/`, `services/`, `repositories/`) — considered and
  rejected. Fights NestJS's module system (a `@Module` would import its three pieces from three
  different top-level directories) and doesn't scale well against this repo's build order (~8 more
  resources planned). Resource-based folders are kept; the repository file just sits alongside the
  existing controller/service files.
- **Supabase-generated `Database` types** — would give compiler-enforced sync between column lists
  and row interfaces, but is a separate, larger adoption decision (codegen step, CI wiring). Not
  introduced here.
- **`ai/ai.service.ts`, `ai/unsplash.service.ts`** — no direct Supabase table access, nothing to
  extract.
- **New tests** — no test suite exists in this backend; not introduced as part of this refactor.
- **Any REST contract / shared-types change** — none needed; this is purely internal structure.

## 4. Order of work

Smallest → largest, so the pattern is proven on trivial files before the big ones:

1. `practice-areas` (19 lines, 1 call)
2. `auth` — `ProfilesRepository` + both guards
3. `events` (173 lines, 8 calls)
4. `articles` (530 lines, 14 calls)
5. `members` (539 lines, 19 calls)
6. `applications` (542 lines, 17 calls incl. storage)

## 5. Verification

- `pnpm typecheck` after each module (or `./node_modules/.bin/tsc --noEmit` from `apps/backend/`
  per that app's `CLAUDE.md`).
- Spot-check 2-3 endpoints per touched module via curl — no behavior change is expected, so this is
  confirming the extraction didn't drop a query or change a response shape, not testing new
  behavior.
