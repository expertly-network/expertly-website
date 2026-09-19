# AI-powered search across members, articles, and events

Status: approved (Round 1 scope), pending implementation. Date: 2026-09-10.

## Problem

There is no cross-entity or natural-language search anywhere in the product today.
`docs/master-tdd.md` §8.3 flags a homepage global search bar as low-priority/unscoped, and
per-resource filtering is uneven: `GET /v1/members` already supports rich filters (`q`, practice
area, country, rate range), but `GET /v1/articles` only supports `authorId` and `GET /v1/events`
only supports `upcoming` — despite both tables already storing country/city/date/author/category
data that simply isn't exposed as query params yet.

The ask: let a user type a free-form question ("show me members from Chennai charging
$400–500/hr", "articles by Gaurav Sharma on compliance", "events in Singapore in October") and get
a real, grounded natural-language answer back — covering members, articles, and events
individually, or all three together.

## Scope of this round

Per this repo's backend/frontend session split (root `CLAUDE.md`), **this round is backend only**:
the new endpoint, the filter extensions, and the AI orchestration — verified with `curl`, no UI.
The four visible search boxes (homepage + one each on the Members/Articles/Events pages) are a
separate follow-up session that consumes this contract as fixed, once it exists.

## Architecture

Three steps per request, none of which trust each other's raw output as fact without a database
round-trip in between:

1. **Extract** — the AI reads the user's question and returns *structured filters only* (never
   prose, never an answer). It's given the exact field names/types it's allowed to use.
2. **Query** — the backend runs those filters as a normal, deterministic database query against
   the real tables. No AI involved in this step — this is what makes the numbers/names in the
   final answer trustworthy.
3. **Synthesize** — the real rows from step 2 (and *only* those rows) are handed back to the AI
   with an instruction to answer strictly from what it was given. If nothing matched, it says so
   rather than inventing a result.

Both AI calls reuse the existing `apps/backend/src/ai/AiService`, the same `AI_PROVIDER`/`AI_MODEL`
env config already used by article drafting — no new provider, no new client. They use the Vercel
`ai` SDK's `generateObject()` (structured output against a zod schema) rather than `generateText()`
— this repo's `AiService` only calls `generateText()` today, so `generateObject()` is a new but
same-SDK capability; confirmed available in the already-installed `ai` package version as part of
verification (see below).

## Field tiers

Every field in `member_profiles`, `articles`, and `events` falls into one of three buckets. This
tiering is the actual mechanism that makes "ask about any field" true without hand-maintaining an
ever-growing, brittle list of AI-extractable filters.

**Tier 1 — structured filters** (exact/range match, become real query params, and are the only
fields the AI's extraction schema is told about by name):

| Resource | Fields |
|---|---|
| Members | `country`, `state`, `city`, `region`, `years_of_experience`, `rate_min_cents`/`rate_max_cents`, `member_tier`, `is_available`, `is_verified`, practice areas (via `member_services`) |
| Articles | `practice_area_ids`, `countries`, `state`, `created_at` (date range), `creation_mode`, author (resolved to `author_id` via a `profiles` name lookup) |
| Events | `country`, `city`, `event_type`, `event_format`, `is_free`, `start_date`/`end_date` (date range) |

**Tier 2 — free text** (no fixed shape; anything the AI can't map to a Tier-1 field becomes a
leftover search string, matched with a plain multi-column `ILIKE '%term%'` OR across these columns
— **no new database column, no migration, no tsvector/GIN index in this round**, since current row
counts are small; per `docs/master-tdd.md` §8.3 this is explicitly acceptable at current volume,
and adding a generated tsvector column now would be designing for a future requirement, not
today's):

- Members: `headline`, `bio`, `firm_name`, and all 8 jsonb sections
  (`work_experiences`/`educations`/`engagements`/`qualifications`/`credentials`/`testimonials`/
  `awards`/`key_clients`) — matched by casting the jsonb column to text (`work_experiences::text
  ILIKE ...`), so "worked at Deloitte" or "CFA credential" still matches even though those live
  inside array items, not their own columns.
- Articles: `title`, `body`, `excerpt`.
- Events: `title`, `description`, `short_description`, `organiser_name`, `venue_name`.

**Tier 3 — never searchable, regardless of existing as a column.** Hard-excluded from both the
AI's extraction schema and the ILIKE fallback — not a prompt instruction the model could be talked
out of, an actual code-level allowlist:

- Members: `contact_email`, `contact_phone`, `linkedin_url`, `application_id`,
  `renewal_payment_status`.
- Articles: `rejection_reason`.

Rationale: these are PII (email/phone) or internal-moderation-only fields. Letting a public search
endpoint surface them would mean anyone could enumerate a member's phone number or read internal
rejection notes by phrasing the right question.

## New endpoint

**🌐 `GET /v1/search`** — public, matching the posture of the three list endpoints it wraps (all
already `@Public()`). Never touches a signed-in-only detail route (`GET /v1/articles/:id`, `GET
/v1/members/:id`) — only the public list methods, so no new data-exposure surface beyond what's
already public today, just easier to reach via a sentence instead of a form.

**Query params:** `q` (the natural-language question, required), `scope`
(`all`\|`members`\|`articles`\|`events`, default `all`).

**Response `200`:** new `SearchResponseDto` (added to `packages/shared-types/search.ts`):

```ts
interface SearchResponseDto {
  answer: string; // the synthesized natural-language answer
  scope: 'all' | 'members' | 'articles' | 'events';
  interpretedFilters: {
    members?: Record<string, unknown>;
    articles?: Record<string, unknown>;
    events?: Record<string, unknown>;
  }; // what the AI extracted — not shown in round 1's UI, kept for debugging/a future
     // "here's what I searched for" affordance, cheap to include now
  mentions: {
    memberIds: string[];
    articleIds: string[];
    eventIds: string[];
  }; // lets a future frontend hyperlink names/titles the answer text mentions back to their
     // real pages, without the primary surface becoming a result-card grid
}
```

**Errors:** `400` if `q` is empty/missing. AI-provider failures (extraction or synthesis call
throws) surface as `502` with a generic "search is temporarily unavailable" message — never a raw
provider error string.

**Empty/ambiguous handling:**
- Zero rows matched → `answer` says so plainly (no fabricated result).
- `scope=all` and the question doesn't clearly target any of the three resources → the extraction
  step's internal `targets` list (which resource types to query — not itself part of the response
  body; it just determines which keys `interpretedFilters` ends up with) comes back empty, no
  database queries run, and `answer` says the question doesn't seem to relate to members, articles,
  or events.
- A query the model can't parse into any Tier-1 filter at all → treated as pure Tier-2 free text
  against whichever resource(s) are in scope, not a failure.

## Backend contract extensions (Tier-1 query params)

All additive — no `/v2`, no breaking change, `docs/rest-api.md` and `packages/shared-types/`
updated to reflect the new optional params:

- **`GET /v1/members`**: add `city` (the DTO already returns it; only `country` is currently
  filterable).
- **`GET /v1/articles`**: add `authorName` (matched with `ILIKE '%term%'` against
  `profiles.first_name || ' ' || profiles.last_name`, resolved to one or more `author_id` values
  before the articles query runs — partial/case-insensitive, not exact), `practiceAreaId`,
  `country`, `dateFrom`/`dateTo`, and `q` (wired to the Tier-2 ILIKE fallback described above).
- **`GET /v1/events`**: add `country`, `city`, `eventType`, `eventFormat`, `isFree`,
  `dateFrom`/`dateTo`, and `q` (same Tier-2 fallback).

These are genuinely useful on their own (a human typing into a future "filter articles" form
benefits too), not search-only plumbing — but they're being added *now* because the search feature
needs them, per this repo's "additive when the UI/feature genuinely needs it" rule.

## New module

`apps/backend/src/search/` (mirrors the existing per-resource module shape):
- `search.module.ts` — imports `MembersModule`, `ArticlesModule`, `EventsModule`, `AiModule`.
- `search.controller.ts` — the one `@Public() GET /v1/search` route.
- `search.service.ts` — orchestrates extract → query → synthesize; owns the Tier-3 exclusion
  allowlist and the `targets` short-circuit for empty/irrelevant `scope=all` queries.

`AiService` gets two new methods (`extractSearchFilters`, `synthesizeSearchAnswer`), each a
`generateObject()` call with a zod schema scoped to the request's `scope`, following the same
provider-resolution pattern (`AI_PROVIDER`/`AI_MODEL`) as every existing method in that file.

## Explicitly out of scope (this round)

- The four visible search boxes (homepage + Members/Articles/Events pages) — separate frontend
  session, contract-first per this repo's convention.
- Tier-2 upgrade to Postgres `tsvector`/`pg_trgm` — plain `ILIKE` is enough at current data volume;
  revisit only if this gets slow in practice.
- Vector/embedding semantic search — explicitly not scoped per root `CLAUDE.md`; nothing here adds
  an embedding column or calls an embedding API.
- Rate limiting / abuse protection on the new endpoint. **Flagged, not silently skipped**: this is
  the first public, unauthenticated endpoint in the repo that spends real AI-provider money per
  call (two `generateObject()` calls each), unlike every other `@Public()` route which is a plain
  DB read. No throttling infra (`@nestjs/throttler` or equivalent) exists in this backend today.
  Needs an explicit decision before/at implementation time — not assumed away.

## Verification (curl, no frontend, per this repo's backend-session convention)

1. `pnpm --filter ./apps/backend typecheck`.
2. Confirm `generateObject()` works against the currently configured `AI_PROVIDER`/`AI_MODEL` with
   a throwaway zod schema before wiring the real ones.
3. `curl 'GET /v1/search?q=members from Chennai between $400 and $500&scope=members'` — confirm
   `interpretedFilters.members` shows `city: "Chennai"` and a rate range, and `answer` only
   describes rows actually in the members table.
4. `curl 'GET /v1/search?q=articles by <a real seeded author name> on <a real seeded practice area>&scope=articles'`.
5. `curl 'GET /v1/search?q=events in <a real seeded city> in <a real seeded month>&scope=events'`.
6. `curl 'GET /v1/search?q=<something unrelated to the product>&scope=all'` — confirm no rows
   queried, `answer` says it doesn't relate to members/articles/events.
7. `curl` a query that should legitimately return zero rows — confirm `answer` says so and doesn't
   fabricate a result.
8. Confirm none of the Tier-3 fields (email, phone, rejection reason) appear in any `answer` or
   `interpretedFilters`, even when the query explicitly asks for them (e.g. "what's the phone
   number of member X") — the model should refuse/ignore, and this should also be true structurally
   (the extraction schema has no field for it), not just prompt-level.
