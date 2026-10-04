# AI-Inferred Article Taxonomy — Design Spec

**Status:** Proposed — approved in brainstorming, not yet implemented.

**Scope:** Builds on top of
`docs/superpowers/specs/2026-10-03-adaptive-article-ai-flow-design.md`, which is implemented but
not yet committed (sitting as an uncommitted diff on local `main` as of this writing). This spec
assumes that work exists and extends it — it is not a replacement. Covers both backend and
frontend changes to `apps/backend`/`apps/frontend`; per root `CLAUDE.md`'s session split these
still land as two sessions, but are specified together here since the contract change is small
enough to reason about as one piece.

## 1. Why

The AI article wizard currently asks the member to manually select Service(s) and Country (both
required) and optionally State and Title, *before* writing anything about what the article is
actually about. The client's feedback: the AI should infer all of this — service/category,
country, state, and title — from what the member actually writes, picking only from the real,
existing taxonomy (never inventing a service or country that doesn't exist), and show the member
what it inferred so they can correct it rather than making them fill it in blind beforehand.

## 2. Resolved decisions (from brainstorming)

- Inference happens as part of the **same `ai-draft` generation call** — not a separate
  pre-generation step, and not a new endpoint. The model is given the real services/countries
  lists alongside the brief and asked to return its picks alongside `{title, body}`.
- The inferred service(s)/country/state are shown **after generation**, in the existing
  draft-review screen (alongside title/body/sources), as the same editable `MultiSelect`
  components already used elsewhere — pre-filled, not read-only.
- Title is fully AI-driven now too — the manual "Title of the article" input is removed from
  step 1 entirely, consistent with service/country/state moving the same direction.
- The adaptive follow-up-questions step (`ai-followup-questions`) no longer needs or accepts
  `serviceIds`/`countries`/`state` — it generates purely from notes/recent-developments/advice.
  Follow-up question quality observed in this session's own live testing came from the notes
  content, not from service/country context, so no separate earlier inference step is needed just
  to feed that call.
- A refine pass (`ai-refine`, the inline "rephrase" box) **never touches the taxonomy** — it's
  set once at generation time and from then on only member-edited, never silently overwritten by
  a later refine response.

## 3. End-to-end flow

1. **Step 1 ("Tell us about it")**: notes (required), recent developments (optional), advice
   (required), source material (optional file upload/links). No service, country, state, or title
   fields.
2. **Step 2 (adaptive follow-ups, conditional)**: unchanged in shape, but its backend call now
   only ever sends `{notes, recentDevelopments?, advice}` — no taxonomy fields exist to send.
3. **Generate**: the model receives the full brief plus the real active services list
   (`{id, name}` pairs) and the real countries list, and returns `{title, body, services:
   string[], countries: string[], state: string | null}` alongside its existing output. The
   backend validates `services`/`countries` against the real lists (resolving matched service
   names to real IDs), dropping anything that doesn't match — the model is never trusted to
   self-report valid IDs or names it wasn't given.
4. **Draft review screen**: title, body, sources render as today; service(s)/country/state now
   also render as editable `MultiSelect`/input fields, pre-filled from the response. If inference
   returned nothing valid (rare — treated as a normal empty-selection state, not an error), the
   fields just start empty and the member picks manually, same as `CreateArticleRequest` already
   requires at actual save time regardless.
5. **Continue to preview / Publish**: unchanged — still needs real `serviceIds`/`countries` to
   create the article, now sourced from the member-reviewed selection instead of step-1 input.

## 4. Backend contract changes

### `POST /v1/articles/ai-followup-questions`

**Request** (`AiFollowUpQuestionsRequest`) shrinks:
```ts
interface AiFollowUpQuestionsRequest {
  notes: string;
  recentDevelopments?: string;
  advice: string;
}
```
`serviceIds`/`countries`/`state` are removed, not made optional — the client will never send them
again, and an unused-but-accepted field is worse than no field. Response shape (`{questions:
string[]}`) is unchanged.

`AiService.generateFollowUpQuestions()`'s brief-building drops the `Service(s):`/`Countries this
applies to:`/`State/province:` lines entirely (they no longer have a source).

### `POST /v1/articles/ai-draft`

**Request** (`AiDraftArticleRequest`) shrinks — removes `title`, `serviceIds`, `countries`,
`state`:
```ts
interface AiDraftArticleRequest {
  notes?: string;
  recentDevelopments?: string;
  advice?: string;
  followUpAnswers?: { question: string; answer: string }[];
  followUpQuestionsAsked?: string[];
  sourceLinks?: string[];
  includeVisual?: boolean;
  tone?: string;
  extraInstructions?: string;
}
```
(`notes`/`advice` stay optional at the DTO level, matching the existing pattern where the real
"must be filled in" enforcement is a client-side step-1 gate, not a hard server requirement — see
§9 for why this matters.)

**Response** (`AiDraftArticleResponse`) grows:
```ts
class AiDraftArticleResponse {
  title!: string;
  body!: string;
  sources?: ArticleSource[] | null;
  /** AI-inferred, validated against the real active services list. Empty if nothing matched. */
  serviceIds!: string[];
  /** AI-inferred, validated against the real countries list. Empty if nothing matched. */
  countries!: string[];
  /** AI-inferred if clearly implied, otherwise null. Free text, not validated against a list
   *  (countries/services are enums in practice; state has never been — same posture as the
   *  existing manual write flow, which also doesn't validate state against anything). */
  state!: string | null;
}
```

### Controller/service wiring

`ArticlesController.aiDraft()` currently does `resolveServiceNamesList(dto.serviceIds)` to turn
client-sent IDs into names for the prompt. That input no longer exists. Replace it with fetching
the **full** active services list as candidates:
```ts
const categories = await this.categoriesService.list(); // already active-filtered
const candidateServices = categories.flatMap((c) => c.services.map((s) => ({ id: s.id, name: s.name })));
return this.aiService.generateDraft(dto, candidateServices, sourceFileTexts, user.id);
```
`AiService.generateDraft()`'s second parameter changes from `serviceNames: string[]` to
`candidateServices: { id: string; name: string }[]` — it's now both the prompt's candidate list
*and* the validation/resolution source (name → id), not just prompt text.

### Countries list — a deliberate backend-side duplicate

`packages/shared-types` cannot hold this (its own README: type-only, no runtime values — see that
folder's hard rule). `apps/frontend/lib/members/countries.ts`'s `ALL_COUNTRIES` has no backend
equivalent today. Add `apps/backend/src/ai/countries.ts` exporting the identical list (copied
verbatim at implementation time), used by `AiService` for both prompt-building and validating the
model's returned country names. This is the same "duplicate deliberately" posture
`packages/shared-types/README.md` already documents for exactly this situation — not a new
pattern.

## 5. Prompt changes

`DRAFT_SYSTEM_PROMPT`'s `BASE_RULES` JSON-output rule changes from:
```
- Output a single JSON object and nothing else — ...: {"title": string, "body": string}.
```
to:
```
- Output a single JSON object and nothing else — ...: {"title": string, "body": string,
  "services": string[], "countries": string[], "state": string | null}.
- "services": pick every service from the list given below that this article genuinely belongs
  to (usually 1, sometimes 2-3) — copy the exact name as given, never invent one, never pick a
  service the article doesn't actually relate to just to fill the array.
- "countries": pick every country from the list given below that this article's guidance
  actually applies to — copy exact names as given, never invent one.
- "state": only if a specific state/province is clearly implied by the content (e.g. referencing
  state-specific rules); otherwise null. Not validated against a list — free text, same as a
  human author would type.
```
followed by the actual candidate lists appended to the brief (not the system prompt — matching
the existing pattern where per-request data like source links lives in the brief, not the
reusable system prompt):
```
Services available (pick only from this list, by exact name):
- <name 1>
- <name 2>
...

Countries available (pick only from this list, by exact name):
- <name 1>
...
```
`REFINE_SYSTEM_PROMPT` is **not** changed — refine never re-infers taxonomy (§2), so its output
schema stays `{title, body}` and `parseDraftResponse()` (shared, unchanged) keeps working for it
exactly as today.

## 6. Parsing and validation

`parseDraftResponse()` (shared by `generateDraft`, `refineDraft`, and the existing word-count
correction pass) is **not** changed — it still only extracts `{title, body}`. A new, separate
function handles the taxonomy fields, since only `generateDraft()`'s direct model response (not
the word-count-correction re-prompt, not refine) ever needs them:

```ts
function parseDraftTaxonomy(
  text: string,
  candidateServices: { id: string; name: string }[],
  candidateCountries: string[]
): { serviceIds: string[]; countries: string[]; state: string | null } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { serviceIds: [], countries: [], state: null };
  try {
    const parsed = JSON.parse(match[0]) as { services?: unknown; countries?: unknown; state?: unknown };
    const serviceIds = Array.isArray(parsed.services)
      ? parsed.services
          .filter((n): n is string => typeof n === 'string')
          .map((name) => candidateServices.find((s) => s.name === name)?.id)
          .filter((id): id is string => Boolean(id))
      : [];
    const countries = Array.isArray(parsed.countries)
      ? parsed.countries.filter((c): c is string => typeof c === 'string' && candidateCountries.includes(c))
      : [];
    const state = typeof parsed.state === 'string' && parsed.state.trim() ? parsed.state.trim() : null;
    return { serviceIds: [...new Set(serviceIds)], countries: [...new Set(countries)], state };
  } catch {
    return { serviceIds: [], countries: [], state: null };
  }
}
```
Called once, right after the initial `generateText()` call in `generateDraft()`, against the
**original** response text — never re-derived from a word-count-correction pass (§2: taxonomy is
set once). `ensureWordCount()` itself is unchanged; it still only reads/writes `{title, body}`.

## 7. Audit logging

`logGeneration()` currently writes `input.serviceIds`/`input.countries`/`input.state` (the
client-sent values) into `ai_draft_generations`. Since those are now essentially always absent,
switch it to log the **inferred** values instead — the whole point of the audit table is
reviewing how the AI generation is actually performing, and "what did it infer" is now the
meaningful signal, not "what did the client send" (which was always real before, now would be
empty noise). `core_answers` keeps logging `notes`/`recentDevelopments`/`advice` unchanged.

## 8. Frontend changes

- `AiDraftWizard.tsx` step 1: remove the Service(s)/Country MultiSelect grid, the State input, and
  the Title input. Keep notes/recentDevelopments/advice/source-material exactly as positioned
  today (minus the fields removed).
- `continueFromStep1()`: `getFollowUpQuestions({ notes, recentDevelopments, advice })` — drop
  `serviceIds`/`countries`/`state` from the call.
- `generate()`: `generateArticleDraft({ notes, recentDevelopments, advice, followUpAnswers,
  followUpQuestionsAsked, sourceLinks, includeVisual, tone, extraInstructions }, files)` — drop
  `title`/`serviceIds`/`countries`/`state`.
- Draft-review screen (the `if (draft) { ... }` branch): add local state
  `const [reviewedServiceIds, setReviewedServiceIds] = useState<string[]>([])` /
  `reviewedCountries` / `reviewedState`, initialized from `draft.serviceIds`/`draft.countries`/
  `draft.state` via a `useEffect` (or simply on first render when `draft` is set, since this
  screen only mounts once a draft exists — a derived-state pattern keyed off `draft` is fine
  here, matching how `refinementNotes` etc. already work as plain local state in this
  component). Render the same `MultiSelect` (services, countries) and `Input` (state) components
  already imported and used in step 1 today, now living in this screen instead.
  `onDrafted({ title: draft.title, body: draft.body, serviceIds: reviewedServiceIds, countries:
  reviewedCountries, state: reviewedState, coverImageUrl })` — unchanged interface, now sourced
  from review-time state.
- `rephrase()`: unchanged except it must **not** touch `reviewedServiceIds`/`reviewedCountries`/
  `reviewedState` — only `draft.title`/`draft.body`/`draft.sources` update from a refine response
  (refine's response has no taxonomy fields to begin with per §5, so this falls out naturally as
  long as the review-state variables aren't reset anywhere a refine touches).
- `WriteArticleFlow.tsx`: no change needed — `AiDraftedArticle`'s shape is unchanged, just now
  populated from review-time state instead of step-1 state internally within the wizard.

## 9. Edge cases

- **`ai-draft`'s `notes`/`advice` stay optional at the DTO level** (unchanged from the original
  adaptive-flow spec), even though step 1's `continueFromStep1()` already blocks `Continue` until
  both are non-empty — that's a pre-existing soft-vs-hard split this spec doesn't touch.
  `ai-followup-questions`'s `notes`/`advice` are, and remain, **required** at the DTO level (also
  unchanged) — the two endpoints have never matched on this point, and this spec doesn't make
  them match now.
- **AI infers zero valid services/countries** — not an error. Review screen's selectors start
  empty; `CreateArticleRequest` still requires both at actual save time, so the member is forced
  to pick manually there if they skip correcting it on the review screen too. No new validation
  needed — this is the existing save-time contract, untouched.
- **AI infers a service/country not actually relevant** (false positive) — member removes it via
  the same `MultiSelect` remove-chip interaction already in use everywhere else in this app.
  No new UI pattern needed.
- **Member answers notes so vaguely nothing can be inferred** — same as the empty-inference case
  above; degrades to manual selection, not a blocking error.
- **A refine changes the article's actual subject matter** (e.g. "make this about partnerships
  instead of trusts") — taxonomy is still not re-inferred (§2's explicit decision). This is a
  known, accepted limitation: the member can still manually fix the service selection on the
  review screen after such a refine. Not re-litigating this in implementation without a product
  decision to change it.

## 10. Explicitly deferred

- Re-inferring taxonomy on refine.
- Any backend-side canonical country list shared with the frontend (still two copies, duplicated
  deliberately — see §4). Unifying them is a separate discussion if drift ever becomes a real
  problem, not pre-solved here.
- Logging "what the model considered but didn't pick" for audit purposes — only the final
  resolved selection is logged, matching the existing audit table's posture of recording outcomes,
  not model reasoning.

## 11. Phased plan

1. **Backend**: shrink `AiFollowUpQuestionsRequest`/`AiDraftArticleRequest`, grow
   `AiDraftArticleResponse`, add `apps/backend/src/ai/countries.ts`, extend `DRAFT_SYSTEM_PROMPT`
   + add `parseDraftTaxonomy()`, rewire the controller to fetch all active services as candidates,
   update `logGeneration()`. Update `docs/rest-api.md`, `docs/database-erd.md`,
   `packages/shared-types/article.ts`, Postman — same session, per root `CLAUDE.md`.
2. **Frontend** (separate session): step 1 simplification, review-screen taxonomy selectors,
   `continueFromStep1()`/`generate()` payload changes.
