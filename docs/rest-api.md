# Expertly — REST API

Fixed contract, derived once per feature and implemented before any frontend work touches it — see
`CLAUDE.md`. Base path `/v1`. Additive changes (new optional field, new endpoint) don't need a
version bump; anything that changes an existing shape goes to `/v2`.

**Access levels** (matching `docs/auth.md`'s guard model):

| Badge | Meaning |
|---|---|
| 🌐 Public | No auth required (`@Public()`) |
| 🔑 Auth | Any authenticated role |
| 🔒 Owner | Auth, scoped to the caller's own resource |
| _role_ | Auth, restricted to exactly that role (see note below) |

## Membership applications

Backing `apps/backend/src/applications/`, `apps/backend/src/practice-areas/`. Schema:
`docs/database-erd.md`. Shared types: `packages/shared-types/membership-application.ts`,
`packages/shared-types/practice-area.ts`.

### 🌐 `GET /v1/practice-areas`

Returns active practice areas for the application wizard's service-preference dropdowns (and,
later, the member directory's filter).

**Response `200`:** `PracticeAreaDto[]` — `{ id: string, name: string, category:
'taxation'|'legal'|'finance_advisory' }[]`. `category` backs the pill-filter UI in the design
(`onboarding_form.html`'s service-preference step) — see `docs/database-erd.md`'s `practice_areas`
section for the full mapping.

### _client_ `POST /v1/applications`

Submits a membership application in one request — the wizard's multi-step UI is frontend-only
state; nothing is persisted until this call. **Restricted to exactly `role='client'`** — not
expressed via `@Roles()`, since that decorator's ranked model (`admin` satisfies a `member` check)
is wrong here; enforced as an explicit check in `ApplicationsService.create()` instead. A `member`
or `admin` token reaches this far (passes the auth guard, passes body validation) and then gets a
`403`, not a `401`/`400` — a deliberate ordering: NestJS validates the request body before the
controller method (and this role check) ever runs, so a malformed body from a non-client caller
surfaces as `400` first, not `403`. Not a security issue — both outcomes correctly reject the
request — just don't rely on `403` from a wrong-role request that also happens to be malformed.

**Request:** `CreateApplicationRequest` (see `packages/shared-types/membership-application.ts` for
the full shape). Notably:
- `servicePreferences[].practiceAreaId` is validated against a live `practice_areas` query before
  insert — the DB has no FK to catch an invalid id (a deliberate trade-off, see
  `docs/database-erd.md`), so this endpoint is the only thing enforcing it. Do not bypass this
  check in any future code path that writes to this table.
- `selectedTier`, `listPriceCents`, `discountAmountCents`, `amountDueCents`, `paymentStatus`,
  `status`, `applicantId` are **never accepted from the client** — sending them is rejected
  outright (`forbidNonWhitelisted`), confirmed by test. All computed server-side:
  - `selectedTier`: `yearsOfExperience > 12 → seasoned_professional`, else `budding_entrepreneur`
    (`apps/backend/src/applications/constants/pricing.ts`).
  - `listPriceCents`: flat `$499/year` or `$49/month` regardless of tier — confirmed against
    `design/static_html/membership.html`, which shows no tier-based pricing.
  - `couponCode` (optional, free text) is checked against a small hardcoded map
    (`apps/backend/src/applications/constants/coupons.ts`) — no `coupons` table exists (see
    `docs/database-erd.md`). An unrecognized code is rejected with `400`, not silently ignored.
  - `paymentStatus` is `waived` if `amountDueCents` resolves to `0`, else `pending`. `paid` is
    reserved for whenever a real payment gateway is integrated — unreachable today.
- Rejects with `409` if the caller already has a `submitted` or `under_review` application.
- Rejects with `400` if `rateMaxCents <= rateMinCents` (checked in the service — class-validator
  doesn't do cross-field checks cleanly for one call site; the DB also enforces this via a CHECK
  constraint as a second line of defense).

**Response `201`:** `ApplicationDto` — the full stored record, including resolved
`servicePreferences[].practiceAreaName`.

**Errors:** `401` no/invalid token · `403` not a client account · `409` application already in
progress · `400` validation failure (malformed body, invalid practice area id, invalid coupon,
`rateMax <= rateMin`).

### 🔒 `GET /v1/applications/me`

The caller's own most recent application. Always owner-scoped by the authenticated user's id —
never accepts an id param, so there's no cross-user access surface.

**Response `200`:** `ApplicationDto`. **`404`** if the caller has no application.

## Membership applications — not built yet (explicitly deferred)

- Admin review (`PATCH /v1/applications/:id` approve/reject) — `reviewed_by`/`reviewed_at`/
  `rejection_reason` columns exist on `membership_applications` for this, but no endpoint writes
  them. Deferred per explicit product decision, not an oversight.
- Anything that provisions a `member_profiles` row / flips `profiles.role` to `member` — depends
  on the admin review endpoint above.
- Member directory (`GET /v1/members`, `GET /v1/members/:id`) — separate future backend session.
- Real payment gateway integration — `payment_status='paid'` is modeled but unreachable.

## Articles

Backing `apps/backend/src/articles/`. Schema: `docs/database-erd.md`. Shared types:
`packages/shared-types/article.ts`.

### 🌐 `GET /v1/articles`

The browse grid — published articles only, list shape (no `body`).

**Response `200`:** `ArticleListItemDto[]`, newest first.

### 🔒 `GET /v1/articles/mine`

The caller's own articles, any status (`draft` included). Empty array if none — not a `404`, since
this is a list endpoint, unlike `GET /v1/applications/me`.

**Response `200`:** `ArticleListItemDto[]`, newest first.

### 🔑 `GET /v1/articles/:id`

Full article detail, including `body`. Requires being signed in (any role) — **a deliberate product
decision, not something the static prototype itself enforces**; see
`docs/database-erd.md`'s "Design decisions" note for the full reasoning.

If the article's `status` is `draft`, only its own author or an `admin` can read it — everyone else
gets **`404`, not `403`**, so a non-owner can't distinguish "doesn't exist" from "exists but isn't
published yet."

**Response `200`:** `ArticleDto`. **Errors:** `401` no/invalid token · `404` not found, or a draft
the caller can't see.

### `member` `POST /v1/articles`

Creates and immediately publishes an article. `@Roles('member')` — `admin` passes too via
`RolesGuard`'s ranked model (admin rank ≥ member rank); `client` is rejected. Unlike
`POST /v1/applications`, this doesn't need an exact-role check — "member or admin" fits the ranked
model directly.

**Request:** `CreateArticleRequest` (see `packages/shared-types/article.ts`). Notably:
- `authorId` is never accepted from the client — always the caller's own id.
- `status` is never accepted — always created as `published`.
- `excerpt`, `readTimeMinutes` are never accepted — always server-derived from `body`.
- `body` must be 800–2000 words (from the design's own "Write it yourself" validation copy),
  checked in `ArticlesService`, not expressible as a class-validator decorator for a single field.
- `practiceAreaIds` validated against a live, `is_active`-filtered `practice_areas` query before
  insert — same load-bearing check as applications' `servicePreferences`; see
  `docs/database-erd.md`.

**Response `201`:** `ArticleDto`. **Errors:** `401` no/invalid token · `403` client account · `400`
validation failure (malformed body, word count out of range, invalid/inactive practice area id).

### 🔒 `PATCH /v1/articles/:id`

Partial update. `@Roles('member')` rejects `client` at the guard layer; a finer-grained check in
`ArticlesService` then requires the caller be the article's own author **or** `admin` — anyone else
gets `403`. Owner or admin may also change `status` between `draft`/`published` here (self-service
unpublish/republish) — there's no separate moderation endpoint, since this session doesn't build an
admin review queue (see `docs/database-erd.md`).

**Request:** `UpdateArticleRequest` — all fields optional; only provided fields change. `body`,
`practiceAreaIds` re-validated the same way as `POST` if present; `excerpt`/`readTimeMinutes`
re-derived if `body` changes.

**Response `200`:** `ArticleDto`. **Errors:** `401` · `403` not the owner and not admin · `404` not
found · `400` validation failure.

### 🔒 `DELETE /v1/articles/:id`

Same owner-or-admin check as `PATCH`.

**Response `204`.** **Errors:** `401` · `403` not the owner and not admin · `404` not found.

## Articles — not built yet (explicitly deferred)

- Admin moderation/review queue (`pending`/`rejected` states, approve/reject actions) — the
  prototype models this; this session ships plain ownership-scoped CRUD instead. See
  `docs/database-erd.md`.
- Tags, AI-generated summary bullet points, view/like/comment counters — none of these are real
  per-article data in the prototype (tags are suggested-but-never-saved, summary points are a
  static per-category lookup, engagement is anonymous `localStorage` state) — out of scope for a
  CRUD-with-ownership contract.
- `category`/`country` query-param filtering on `GET /v1/articles` — the prototype filters
  client-side over the full published set; not built server-side yet.
