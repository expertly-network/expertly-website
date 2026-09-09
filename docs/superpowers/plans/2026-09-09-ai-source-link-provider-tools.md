# AI Source-Link Provider Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AiService`'s server-side source-link fetcher (`fetch-safe.ts`, which has a
confirmed DNS-rebinding SSRF gap) with each configured AI provider's own hosted web-fetch/search
tool, so the backend never makes the fetch itself.

**Architecture:** `AiService.generateDraft()`'s brief-building stops pre-fetching URLs; pasted
links go into the prompt as plain text, and a new per-provider tool (`anthropic.tools.
webFetch_20260209`, `google.tools.urlContext`, `openai.tools.webSearch`) is attached to that one
`generateText()` call with `toolChoice` left at its default (`auto`), so the model decides for
itself whether/when to use it. `fetch-safe.ts` is deleted — there's no server-side fetch left to
guard.

**Tech Stack:** NestJS + Fastify backend, Vercel `ai` SDK v7 (`ai@7.0.85`), `@ai-sdk/anthropic@4.0.46`,
`@ai-sdk/openai@4.0.52`, `@ai-sdk/google@4.0.58` (versions confirmed via installed `node_modules` —
exact tool signatures below were read directly from each package's `.d.ts`, not guessed from docs).

**Spec:** `docs/superpowers/specs/2026-09-09-ai-source-link-provider-tools-design.md`

## Global Constraints

- Delete `apps/backend/src/ai/fetch-safe.ts` entirely once nothing imports it — no fallback kept
  for any provider (see spec's "explicitly out of scope").
- `toolChoice` is never set — always the SDK default (`auto`). Do not force a tool call.
- No `stopWhen` override. `generateText`'s default is `stopWhen: isStepCount(1)` (confirmed in
  `ai@7.0.85`'s type defs) — a provider-executed tool's call-then-continue loop happens inside the
  provider's own turn, so the default single step is sufficient. This gets an empirical check in
  Task 4, not just a type-level assumption.
- Google's tool object's key in the `tools: {...}` record **must be exactly `url_context`** — its
  own type declaration says so explicitly ("Must have name 'url_context'"). Anthropic/OpenAI have
  no such documented constraint; their example code uses `web_fetch`/`web_search` respectively —
  keep those same key names for consistency with the providers' own examples.
- No `allowedDomains`/`blockedDomains` config on any tool (YAGNI — not a security requirement here,
  see spec). Anthropic gets `maxUses: 5` (matching `sourceLinks`'s existing `@ArrayMaxSize(5)` DTO
  cap); Google's `urlContext` and OpenAI's `webSearch` take no equivalent count option in this SDK
  version — leave their config objects empty (`{}`).
- Use Anthropic's `webFetch_20260209` (the newer of two available versions in the installed
  package — `webFetch_20250910` also exists but is older).
- `AiDraftRequestDto.sourceLinks` (`apps/backend/src/ai/dto/ai-draft-request.dto.ts`) is
  **unchanged** — still `string[]`, `@ArrayMaxSize(5)`, `@IsUrl` each. The cap now limits how many
  links we tell the model about, not how many we fetch ourselves.
- This repo has no automated test framework (`apps/backend` has zero `.spec.ts` files; the
  project's own convention, per `apps/backend/CLAUDE.md`, is curl-based manual verification). Task
  steps below substitute `pnpm typecheck` for the "run test" gate on code changes, and a dedicated
  manual-curl task (Task 4) for the actual behavioral verification the spec requires — this is the
  TDD red/green cycle adapted to what this codebase actually has, not a skipped step.
- Every step in this plan must leave `pnpm --filter ./apps/backend typecheck` passing before commit.

---

### Task 1: Per-provider source-link tool + wire into `generateDraft()`

**Files:**
- Modify: `apps/backend/src/ai/ai.service.ts`

**Interfaces:**
- Consumes: nothing from another task (first code task).
- Produces: `AiService.generateDraft(input: AiDraftRequestDto, practiceAreaNames: string[], sourceFileTexts: string[]): Promise<ArticleDraftOutput>` — **signature unchanged**, only its
  internal behavior changes. New private method `resolveModelWithSourceLinkTool(): { model: LanguageModel; tools: ToolSet }` — used only inside this file, no other task calls it directly, but
  Task 4's verification exercises it indirectly through `generateDraft()`.

- [ ] **Step 1: Update imports**

Replace the top of `apps/backend/src/ai/ai.service.ts` (lines 1-10):

```typescript
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { generateText, type LanguageModel, type ToolSet } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import sanitizeHtml from 'sanitize-html';
import type { AiDraftRequestDto } from './dto/ai-draft-request.dto';
import type { RefineDraftDto } from './dto/refine-draft.dto';
import { sanitizeArticleBody } from '../articles/sanitize-article-body';
```

(This removes `import { fetchSafeText } from './fetch-safe';` and adds `type ToolSet` to the `ai`
import — nothing else in this block changes.)

- [ ] **Step 2: Replace `fetchSourceLinks` with `resolveModelWithSourceLinkTool`**

Replace the existing `private async fetchSourceLinks(...)` method (current lines 135-146) with:

```typescript
  // generateDraft()-only: resolves both the model AND that provider's own hosted web-fetch/search
  // tool for pasted source links, so the backend never fetches a member-pasted URL itself (see
  // docs/superpowers/specs/2026-09-09-ai-source-link-provider-tools-design.md — this replaces the
  // old fetch-safe.ts, which had a DNS-rebinding SSRF gap). `toolChoice` is left at the SDK
  // default ('auto') everywhere this is used — the model decides for itself whether a given link
  // is worth fetching/searching, same as any other drafting judgment call.
  private resolveModelWithSourceLinkTool(): { model: LanguageModel; tools: ToolSet } {
    const provider = process.env.AI_PROVIDER as AiProvider | undefined;
    const modelId = process.env.AI_MODEL;

    if (!provider || !modelId) {
      throw new ServiceUnavailableException(
        'AI drafting is not configured (set AI_PROVIDER and AI_MODEL).'
      );
    }
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new ServiceUnavailableException(
        `Unsupported AI_PROVIDER "${provider}" (expected one of ${SUPPORTED_PROVIDERS.join(', ')}).`
      );
    }

    switch (provider) {
      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new ServiceUnavailableException('OPENAI_API_KEY is not set.');
        const openai = createOpenAI({ apiKey });
        return { model: openai(modelId), tools: { web_search: openai.tools.webSearch({}) } };
      }
      case 'anthropic': {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not set.');
        const anthropic = createAnthropic({ apiKey });
        return {
          model: anthropic(modelId),
          tools: { web_fetch: anthropic.tools.webFetch_20260209({ maxUses: 5 }) },
        };
      }
      case 'google': {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) throw new ServiceUnavailableException('GOOGLE_GENERATIVE_AI_API_KEY is not set.');
        const google = createGoogleGenerativeAI({ apiKey });
        return { model: google(modelId), tools: { url_context: google.tools.urlContext({}) } };
      }
    }
  }
```

Leave `resolveModel()` (the existing method used by `refineDraft`/`suggestTopics`/
`summarizeArticle`) completely untouched — it has no source-links concept and doesn't need a tool.

- [ ] **Step 3: Update `generateDraft()`'s brief-building and `generateText()` call**

Replace the existing `generateDraft` method (current lines 148-188) with:

```typescript
  async generateDraft(
    input: AiDraftRequestDto,
    practiceAreaNames: string[],
    sourceFileTexts: string[]
  ): Promise<ArticleDraftOutput> {
    const { model, tools } = this.resolveModelWithSourceLinkTool();

    const brief = [
      input.title ? `Working title (may be improved): ${input.title}` : null,
      `Practice area(s): ${practiceAreaNames.join(', ') || 'unspecified'}`,
      `Countries this applies to: ${input.countries.join(', ')}`,
      input.state ? `State/province: ${input.state}` : null,
      input.notes ? `Author's own thoughts/notes:\n${input.notes}` : null,
      input.recentDevelopments ? `Recent developments/regulations to reference:\n${input.recentDevelopments}` : null,
      input.advice ? `Advice/comments the author wants readers to take away:\n${input.advice}` : null,
      input.tone ? `Desired tone: ${input.tone}` : null,
      input.includeVisual
        ? 'If a comparison or breakdown is genuinely relevant to the topic, present it as a <ul>/<ol> list rather than prose (no <table> support).'
        : null,
      input.extraInstructions ? `Additional instructions: ${input.extraInstructions}` : null,
      sourceFileTexts.length > 0
        ? sourceFileTexts
            .map((text, i) => `--- Uploaded source document ${i + 1} ---\n${text.slice(0, 8000)}`)
            .join('\n\n')
        : null,
      input.sourceLinks && input.sourceLinks.length > 0
        ? `Source links the author wants referenced (fetch/search these if useful to ground the article):\n${input.sourceLinks.map((url) => `- ${url}`).join('\n')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    let text: string;
    try {
      ({ text } = await generateText({ model, tools, system: DRAFT_SYSTEM_PROMPT, prompt: brief }));
    } catch (error) {
      this.logger.error('AI article draft generation failed', error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('AI drafting failed — try again or write the article manually.');
    }

    return parseDraftResponse(text);
  }
```

Note what changed: `this.resolveModel()` → `this.resolveModelWithSourceLinkTool()`; the
`fetchSourceLinks`/`linkText` lines are gone; the brief's last entry lists raw URLs instead of
fetched text; `generateText(...)` now passes `tools`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter ./apps/backend typecheck`
Expected: fails at this point only if a type mismatch exists between the tool factories' return
types and `ToolSet` — if so, read the actual error (it will name the exact incompatible field) and
adjust `resolveModelWithSourceLinkTool`'s return type accordingly; do not add `as any`/`as unknown
as ToolSet` casts (root `CLAUDE.md`: no `any`, no exceptions) — the real return type is a concrete,
non-`any` type in each package's `.d.ts`, use it directly if `ToolSet` doesn't unify them.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai/ai.service.ts
git commit -m "feat(ai): fetch source links via each provider's own hosted web tool, not our server"
```

---

### Task 2: Delete the now-unused SSRF-guarded fetcher

**Files:**
- Delete: `apps/backend/src/ai/fetch-safe.ts`

**Interfaces:**
- Consumes: Task 1 must be committed first (it removes the only importer of this file).
- Produces: nothing — this is pure removal.

- [ ] **Step 1: Confirm nothing still imports it**

Run: `grep -rn "fetch-safe" apps/backend/src apps/frontend`
Expected: no matches (Task 1 already removed the one import in `ai.service.ts`).

- [ ] **Step 2: Delete the file**

```bash
git rm apps/backend/src/ai/fetch-safe.ts
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter ./apps/backend typecheck`
Expected: PASS (no remaining references).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(ai): remove fetch-safe.ts, superseded by provider-hosted web tools"
```

---

### Task 3: Update the documented contract

**Files:**
- Modify: `packages/shared-types/article.ts:93`
- Modify: `docs/rest-api.md:271-274`

**Interfaces:**
- Consumes: Task 1 (describes its actual new behavior — do this after, not before, so the docs
  describe what was really built).
- Produces: nothing consumed by later tasks — purely descriptive.

- [ ] **Step 1: Update the shared-types comment**

In `packages/shared-types/article.ts`, replace line 93:

```typescript
  /** Fetched server-side (SSRF-guarded) and folded into the prompt; max 5. */
```

with:

```typescript
  /** Passed to the model as plain text; the model itself decides whether to fetch/search each one
   * via the configured AI_PROVIDER's own hosted web tool (never fetched by our backend). Max 5. */
```

- [ ] **Step 2: Update `docs/rest-api.md`**

Replace the sentence spanning lines 271-274:

```markdown
discarded. `sourceLinks` (max 5) are fetched server-side with SSRF guards
(`apps/backend/src/ai/fetch-safe.ts`: http(s)-only, DNS-resolved IP re-checked against
private/loopback/link-local ranges before and after every redirect hop, 8s timeout, 3MB cap) — a
link that fails to fetch is silently skipped, not a whole-request error. Same `@Roles('member')`
posture as `POST /v1/articles`.
```

with:

```markdown
discarded. `sourceLinks` (max 5) are **not fetched by this backend at all** — they're listed as
plain text in the prompt, and the model itself decides whether/when to fetch or search a given one
using the currently-configured `AI_PROVIDER`'s own hosted web tool (`anthropic.tools.
webFetch_20260209`, `google.tools.urlContext`, or `openai.tools.webSearch` — see `AiService.
resolveModelWithSourceLinkTool`). This replaced an earlier server-side fetch
(`apps/backend/src/ai/fetch-safe.ts`, since deleted) that had a DNS-rebinding SSRF gap — moving the
fetch to the provider's own infrastructure removes that vulnerability class outright rather than
patching it. OpenAI's tool is search-based, not a guaranteed exact-URL fetch like Anthropic/
Google's — source-link grounding quality can differ by configured provider. Same `@Roles('member')`
posture as `POST /v1/articles`.
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/article.ts docs/rest-api.md
git commit -m "docs(ai): describe provider-hosted source-link fetching, remove stale SSRF-guard references"
```

---

### Task 4: Manual verification (the real behavioral check)

**Files:** none — verification only.

**Interfaces:**
- Consumes: Tasks 1-3, complete.
- Produces: confidence that this actually works, for all three providers, before this plan is
  considered done.

- [ ] **Step 1: Start the backend**

Run: `pnpm --filter ./apps/backend dev` (or however it's already running locally).

- [ ] **Step 2: Per-provider grounding check**

For each of `AI_PROVIDER=anthropic`, `AI_PROVIDER=google`, `AI_PROVIDER=openai` in turn (set in
`apps/backend/.env`, restart the backend between switches):

```bash
curl -s -X POST http://localhost:4000/v1/articles/ai-draft \
  -H "Authorization: Bearer <a real member JWT>" \
  -F 'payload={"practiceAreaIds":["<a real practice area id>"],"countries":["India"],"sourceLinks":["https://en.wikipedia.org/wiki/Special:Random"]}'
```

Use a Wikipedia "Special:Random" article (or any real public page with a distinctive fact you can
check by hand) as the source link. Read the returned `body` and confirm it actually reflects
something specific from that page — not a generic, could-be-about-anything paragraph. This is the
empirical check on the "no `stopWhen` needed" assumption in Global Constraints: if the response
reads as ungrounded/generic for a provider, that provider's tool call likely isn't completing
within the default single step, and `stopWhen: isStepCount(2)` (or higher) needs to be added back
for that case — re-open this task and adjust `resolveModelWithSourceLinkTool` if so.

Expected: PASS for Anthropic and Google (both have an exact-URL-fetch tool) with content clearly
grounded in the random page fetched. OpenAI is expected to be weaker/more search-like per the
documented gap — confirm it doesn't error, not that it's equally grounded.

- [ ] **Step 3: Broken-link resilience check**

Repeat Step 2's curl (any one provider) with `"sourceLinks":["https://this-domain-does-not-exist-abc123xyz.test"]`.

Expected: the request still returns `201` with a real draft — a link the tool can't reach must not
fail the whole generation, matching the old fetcher's "skip what didn't work" behavior.

- [ ] **Step 4: Full typecheck one more time**

Run: `pnpm --filter ./apps/backend typecheck`
Expected: PASS.

No commit for this task — it's verification of Tasks 1-3's already-committed work. If Step 2
reveals a real problem, fix it as an amendment to Task 1's commit (or a new small commit) before
considering this plan done.
