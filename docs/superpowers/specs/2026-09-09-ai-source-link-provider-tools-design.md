# AI drafting source-links: move fetching to the model provider

Status: approved, pending implementation. Date: 2026-09-09.

## Problem

The AI article-drafting wizard's "sources & style" step lets a member paste up to 5 URLs; the
backend fetches each one server-side (`apps/backend/src/ai/fetch-safe.ts`) and folds the extracted
text into the prompt sent to the model. A pre-push senior review found `fetch-safe.ts`'s SSRF guard
has a DNS-rebinding gap: it validates a hostname's IP via one `dns.lookup()` call, then `fetch()`
resolves the same hostname again independently — an attacker controlling a domain with a
near-zero-TTL DNS record can answer the validation lookup with a public IP and the connection
lookup with an internal one (e.g. `169.254.169.254`), defeating the private-IP blocklist entirely.

Rather than patch that gap in our own fetcher, the decision (discussed at length in-session) is to
stop fetching server-side at all, and instead give the model provider's own hosted web-fetch/search
tool to the model — Anthropic, OpenAI, and Google each already run and maintain their own hardened
version of exactly this capability. This eliminates the vulnerability class outright (our backend
never makes the network request, so it's structurally not the one being tricked) rather than
maintaining a bespoke SSRF guard indefinitely.

## Current behavior (being replaced)

`AiService.generateDraft()` (`apps/backend/src/ai/ai.service.ts`):
1. Calls `this.fetchSourceLinks(input.sourceLinks)`, which runs `fetchSafeText()` per link
   (`fetch-safe.ts`: SSRF-guarded fetch, 8s timeout, 3MB cap, http/https + text/html/text/plain
   only, redirect re-validation).
2. Each successful fetch is truncated to 8000 chars and joined into the `brief` string under a
   `--- Source link N (url) ---` heading.
3. A failed fetch is silently skipped (logged, not surfaced) — one bad link doesn't fail the draft.
4. `generateText({ model, system: DRAFT_SYSTEM_PROMPT, prompt: brief })` — single-shot, no tools.

## New behavior

1. `fetchSourceLinks()` and `apps/backend/src/ai/fetch-safe.ts` are deleted entirely — no
   server-side fetch, no SSRF surface, nothing left to guard.
2. The brief-building code lists the raw pasted URLs as plain text (no pre-fetched content):
   `Source links the author wants referenced (fetch/search these if useful):\n- url1\n- url2`.
3. `generateText()` for `generateDraft()` (and only `generateDraft()` — `refineDraft`/
   `suggestTopics`/`summarizeArticle` don't take links and are untouched) is called with the
   current provider's own hosted web tool attached, resolved by a small switch on the existing
   `AiProvider` type:
   - `anthropic` → `tools: { web_fetch: anthropic.tools.webFetch_20250910({ maxUses: 5 }) }`
   - `google` → `tools: { url_context: google.tools.urlContext({}) }` (Google's own tool/key name —
     it's URL grounding, not a search tool, so it isn't called `web_search` the way the other two
     providers' equivalents are)
   - `openai` → `tools: { web_search: openai.tools.webSearch({}) }` — left with no `filters`/
     `searchContextSize`/`userLocation` config since none of those map onto a real requirement here
4. `toolChoice` is left at its default (`auto`) — the model decides for itself whether/when a link
   is worth fetching or searching, the same way it already makes other drafting judgment calls. We
   are not forcing a tool call per link.
5. No `stopWhen`/multi-step config is added. All three providers' own published examples for these
   specific tools call `generateText()` as a single-shot call with no `stopWhen` — provider-executed
   tools resolve within the provider's own turn (the whole call-tool-then-continue loop happens on
   their infrastructure inside one API response), unlike a locally-`execute()`d tool, which is the
   case `stopWhen`/multi-step exists for. This is inferred from all three providers' official
   examples doing exactly that (none use `stopWhen`), not from an explicit statement in the SDK
   docs saying so — it gets an explicit empirical check in the verification step below before this
   is considered confirmed.
6. No `allowedDomains`/`blockedDomains` config. The original guard's job was blocking *internal/
   private IP ranges*, not specific public domains — and that concern doesn't carry over: the
   provider's fetch infrastructure runs on its own network, which structurally can't reach
   Expertly's private network or its own cloud metadata endpoint regardless of which domain is
   requested. Domain allow/blocklisting is a content-moderation knob, not a security control here,
   and isn't something we were asked for — left off (YAGNI).
7. Tool-call failures (a link the provider can't fetch/search) are not specially inspected or
   logged on our side. The model sees the tool result (including a failure) in its own context and
   continues drafting — the same "skip what didn't work" behavior as today's per-link try/catch,
   just handled by the model's own turn instead of our loop.

## Files touched

- `apps/backend/src/ai/ai.service.ts` — remove `fetchSourceLinks()`, the `fetch-safe.ts` import,
  and the `linkText` join; add the per-provider tool resolution and attach it to `generateDraft()`'s
  `generateText()` call; update the brief-building to list raw URLs.
- `apps/backend/src/ai/fetch-safe.ts` — deleted.
- `packages/shared-types/article.ts` — `AiDraftArticleRequest.sourceLinks`'s comment currently says
  "Fetched server-side (SSRF-guarded)..." — update to describe the new behavior.
- `docs/rest-api.md` — same comment update, wherever `POST /v1/articles/ai-draft`'s `sourceLinks`
  behavior is documented.
- No DTO shape change (`AiDraftRequestDto.sourceLinks` stays `string[]`, still capped at 5 — the
  cap now limits how many links we tell the model about, not how many we fetch ourselves).
- No frontend change — `AiDraftWizard`'s source-links field already just collects URLs and sends
  them as-is; it has no knowledge of how they get used server-side.

## Explicitly out of scope

- The OpenAI-vs-Anthropic/Google quality gap (OpenAI's tool is search, not "fetch this exact URL")
  is accepted as-is, not solved. No fallback to our own fetcher for OpenAI specifically — that
  would mean keeping the exact code we're trying to stop maintaining, for one provider only.
- No UI indication of which provider is configured or how source links will be handled for it.
- `extract-text.ts` (uploaded source *files*, not links) is unrelated and untouched.

## Verification (per this repo's own "verify a backend session with curl, no frontend needed")

1. `pnpm --filter ./apps/backend typecheck`.
2. With each of the three `AI_PROVIDER` values configured in turn, `curl` `POST /v1/articles/ai-draft`
   with a real `sourceLinks` entry pointing at a real public page containing a distinctive, checkable
   fact (e.g. a specific number or quote), and confirm the returned draft actually reflects that
   fact — this is the empirical check on point 5 above (that a single `generateText()` call really
   does produce grounded final text, not just a bare tool call with no follow-up).
3. Confirm a deliberately-broken link (a domain that doesn't resolve) doesn't fail the whole
   request — the draft should still generate, just without that source.
