# AI Draft — Native Source Documents & Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hand PDFs and images to the AI as native documents instead of extracted text, and
persist every uploaded source file + pasted link to the `ai_draft_generations` audit row.

**Architecture:** `prepareSourceFile()` sniffs each uploaded file and returns either a
`{kind: 'document'}` (PDF/JPEG/PNG/WebP, passed through as raw bytes) or `{kind: 'text'}` (TXT,
embedded as prompt text — unchanged from today). `AiService.generateDraft()` sends `'document'`
entries to the model as native `FilePart` content and `'text'` entries as prompt text, then
persists every prepared file (regardless of kind) to a new private Supabase Storage bucket via
`AiDraftGenerationsRepository`, linking the resulting paths — plus the member's pasted
`sourceLinks` — onto the audit row.

**Tech Stack:** NestJS (Fastify), Supabase (Postgres + Storage), the Vercel `ai` SDK (`ai@^7.0.85`,
already installed), `file-type` (already installed, used for magic-byte sniffing).

**Spec:** `docs/superpowers/specs/2026-10-04-ai-draft-native-source-documents-design.md` — read
this first; it has the full reasoning this plan assumes without repeating.

## Global Constraints

- No route shape changes — `POST /v1/articles/ai-draft`'s request/response stays exactly as
  documented today; `packages/shared-types` is untouched.
- Repository is the only Supabase consumer in a module (`apps/backend/CLAUDE.md`) — all new
  Storage/DB calls go through `AiDraftGenerationsRepository`, never direct from `AiService`.
- `supabase/migrations/0004_tables.sql` is this repo's single ground-truth schema file
  (pre-production convention) — the new bucket/policy/columns fold into it, no new numbered file.
- No `console.log` — `Logger` only, matching every existing file in `apps/backend/src/ai/`.
- **Do not commit or push anything.** This repo's session has a standing instruction from the user:
  all work (this task included) stays as uncommitted changes on local `main` until the user
  reviews everything together. No task below ends with a `git commit` step — this diverges from
  this skill's usual "commit at the end of every task" pattern, deliberately, per that standing
  instruction.
- No test framework exists in `apps/backend` (confirmed: no `test` script in `package.json`, no
  `.spec.ts` files anywhere in the repo) — verification is manual curl/Postman + direct inspection
  of the Supabase dashboard, not automated tests. Task 7 covers this.

---

### Task 1: Repurpose `extract-text.ts` into `prepare-source-file.ts`

**Files:**
- Create: `apps/backend/src/ai/prepare-source-file.ts`
- Delete: `apps/backend/src/ai/extract-text.ts`
- Modify: `apps/backend/package.json` (remove `pdf-parse`, `@types/pdf-parse`, `mammoth`)

**Interfaces:**
- Produces: `PreparedSourceFile` type and `prepareSourceFile(buffer: Buffer, filename: string): Promise<PreparedSourceFile>`, both exported from `apps/backend/src/ai/prepare-source-file.ts`. Task 4 and Task 5 both import from this file.

- [ ] **Step 1: Read the current file to confirm nothing else depends on it beyond what this plan already knows**

Run: `grep -rn "extract-text\|extractSourceFileText" apps/backend/src --include="*.ts"`
Expected output: two matches — the file's own definition, and the one import/call site in
`apps/backend/src/articles/articles.controller.ts` (which Task 5 updates). If you see any other
match, stop and report it — this plan assumes there are none.

- [ ] **Step 2: Create `apps/backend/src/ai/prepare-source-file.ts`**

```ts
import { BadRequestException } from '@nestjs/common';
import { fromBuffer as sniffFileType } from 'file-type';

const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;

const SUPPORTED_DOCUMENT_MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type SupportedDocumentMediaType = (typeof SUPPORTED_DOCUMENT_MEDIA_TYPES)[number];

export type PreparedSourceFile =
  | { kind: 'document'; mediaType: SupportedDocumentMediaType; data: Buffer; filename: string }
  | { kind: 'text'; text: string; filename: string };

// Prepares an uploaded source file for either native-document AI input (PDF/JPEG/PNG/WebP) or
// plain-text prompt embedding (anything with no detected binary type). No text extraction and no
// format conversion happen here anymore — a PDF or image's bytes are passed through untouched so
// the model can read it natively (tables, layout, charts included), which pdf-parse's plain-text
// extraction could never preserve.
export async function prepareSourceFile(buffer: Buffer, filename: string): Promise<PreparedSourceFile> {
  if (buffer.length > MAX_SOURCE_FILE_BYTES) {
    throw new BadRequestException(`${filename} is too large — max 15MB per source file.`);
  }

  const sniffed = await sniffFileType(buffer);

  if (sniffed && (SUPPORTED_DOCUMENT_MEDIA_TYPES as readonly string[]).includes(sniffed.mime)) {
    return {
      kind: 'document',
      mediaType: sniffed.mime as SupportedDocumentMediaType,
      data: buffer,
      filename,
    };
  }
  // No detected binary type means plain text.
  if (!sniffed) {
    return { kind: 'text', text: buffer.toString('utf-8'), filename };
  }

  throw new BadRequestException(
    `Unsupported source file type for ${filename} (expected PDF, JPEG, PNG, WebP, or plain text).`
  );
}
```

- [ ] **Step 3: Delete the old file**

Run: `rm apps/backend/src/ai/extract-text.ts`

- [ ] **Step 4: Remove the now-unused parsing dependencies**

Open `apps/backend/package.json` and remove these three lines from `dependencies`/
`devDependencies` (keep everything else untouched):
```
"mammoth": "^1.12.2",
"pdf-parse": "^1.1.4",
"@types/pdf-parse": "^1.1.5",
```

- [ ] **Step 5: Reinstall to update the lockfile**

Run (from the repo root, not `apps/backend`): `pnpm install`
Expected: lockfile updates, no errors. `pdf-parse`/`mammoth` disappear from
`node_modules/.pnpm` on the next clean install.

- [ ] **Step 6: Typecheck**

Run: `cd apps/backend && ./node_modules/.bin/tsc --noEmit`
Expected: this will currently FAIL — `articles.controller.ts` still imports the deleted
`extractSourceFileText`. That's expected at this point in the plan; Task 5 fixes it. Confirm the
*only* error is that missing import (from `articles.controller.ts`), not anything inside
`prepare-source-file.ts` itself.

---

### Task 2: Storage bucket + schema columns

**Files:**
- Modify: `supabase/migrations/0004_tables.sql`
- Modify: `apps/backend/src/supabase/database.types.ts` (regenerated, not hand-edited)
- Modify: `docs/database-erd.md` (same section as the existing `ai_draft_generations` table —
  folding this in here rather than deferring to Task 6, since the migration and its doc describe
  the same schema and should land together; Task 6 covers `docs/rest-api.md` and the rest of
  `docs/database-erd.md`'s prose)

**Interfaces:**
- Produces: the `ai-draft-sources` Storage bucket, `ai_draft_generations.source_file_paths` (`text[]`), `ai_draft_generations.source_links` (`text[]`). Task 3's `uploadSourceFiles()` writes to this bucket; Task 4's `generateDraft()` populates both columns on insert.

- [ ] **Step 1: Locate the existing `member-proofs` bucket block to match its pattern exactly**

Run: `grep -n "member-proofs\|ai_draft_generations_select_own" supabase/migrations/0004_tables.sql`
You should see the `member-proofs` bucket block (around line 1029) and the end of the
`ai_draft_generations` table's own RLS policy (around line 1026, `ai_draft_generations_select_own`)
— that policy block is where you'll insert the new bucket SQL next, and the table's own `create
table` block (search for `create table public.ai_draft_generations`) is where you'll add the two
new columns.

- [ ] **Step 2: Add the two new columns to `ai_draft_generations`**

Find (inside `create table public.ai_draft_generations (...)`, starting at line 989):
```sql
create table public.ai_draft_generations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  service_ids uuid[] not null default '{}',
  countries text[] not null default '{}',
  state text,
  -- { notes, recentDevelopments, advice } as given in the wizard's first step.
  core_answers jsonb not null,
```
Replace with:
```sql
create table public.ai_draft_generations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  service_ids uuid[] not null default '{}',
  countries text[] not null default '{}',
  state text,
  -- source_file_paths: Storage object paths within the private `ai-draft-sources` bucket for
  -- every file the member uploaded in this attempt (PDF/JPEG/PNG/WebP sent to the AI natively,
  -- plus TXT — all persisted regardless of kind). source_links: the pasted `sourceLinks` URLs as
  -- given, for traceability only — does not imply the AI actually fetched any of them. Both
  -- audit-only, same no-FK posture as `service_ids` above.
  source_file_paths text[] not null default '{}',
  source_links text[] not null default '{}',
  -- { notes, recentDevelopments, advice } as given in the wizard's first step.
  core_answers jsonb not null,
```

- [ ] **Step 3: Add the new Storage bucket, directly after the existing `member-proofs` bucket block**

Find this existing block (search for `member_proofs_owner_rw`):
```sql
insert into storage.buckets (id, name, public)
values ('member-proofs', 'member-proofs', false)
on conflict (id) do nothing;

create policy member_proofs_owner_rw
  on storage.objects for all
  using (bucket_id = 'member-proofs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'member-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
```
Immediately after it (before the next `-- ====...` section header), insert:
```sql
-- ============================================================================
-- Storage — ai-draft-sources bucket, backing POST /v1/articles/ai-draft's source-file
-- persistence. Private (not public) — raw member-uploaded documents/images may contain
-- confidential client material, so no permanent public URL. Objects keyed
-- "<authorId>/<generationId>/<n>-<filename>", same owner-folder convention as member-proofs
-- above. Only the backend's service-role client ever writes here (bypasses RLS); this policy is
-- the same defense-in-depth posture as every other bucket in this schema.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('ai-draft-sources', 'ai-draft-sources', false)
on conflict (id) do nothing;

create policy ai_draft_sources_owner_rw
  on storage.objects for all
  using (bucket_id = 'ai-draft-sources' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ai-draft-sources' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 4: Apply the migration to your local/dev Supabase instance**

Open the Supabase SQL Editor for your dev project (or `supabase db push` if you're using the CLI)
and run the full, updated `supabase/migrations/0004_tables.sql`. Since every statement in it uses
`create table if not exists` / `on conflict do nothing` / `create or replace` patterns already
established in this file, re-running the whole file against a database that already has the
earlier (taxonomy-session) version of this table is safe — confirm this is still true by skimming
the file's existing header comment before running it. Expected: no errors; `ai_draft_generations`
now has the two new columns, and a new `ai-draft-sources` bucket appears under Storage in the
dashboard.

- [ ] **Step 5: Regenerate the TypeScript types**

Run (from `apps/backend`, with `SUPABASE_DB_URL` set to your dev project's connection string — see
this file's own `gen:types` script in `package.json`):
```
pnpm gen:types
```
Expected: `src/supabase/database.types.ts` is rewritten; diff it (`git diff
apps/backend/src/supabase/database.types.ts`) and confirm `ai_draft_generations`'s `Row`/`Insert`/
`Update` types now include `source_file_paths: string[]` and `source_links: string[]`, and that a
new `ai-draft-sources` entry doesn't literally appear in this file (Storage buckets aren't part of
the generated `Database` type — only table/column changes show up here; that's expected, not a
missed step).

- [ ] **Step 6: Update `docs/database-erd.md`'s `ai_draft_generations` table section**

Find the existing table row list for `ai_draft_generations` (search for `| \`sources\` | jsonb`).
Add two new rows immediately after the `state` row:
```
| `source_file_paths` | text[], default `{}` | Storage object paths within the private `ai-draft-sources` bucket for every file the member uploaded in this attempt (PDF/JPEG/PNG/WebP sent to the AI natively, plus TXT — all persisted regardless of kind). Audit-only, same no-FK posture as `service_ids` above. |
| `source_links` | text[], default `{}` | The pasted `sourceLinks` URLs as given, for traceability only — does not imply the AI actually fetched any of them (see `docs/rest-api.md`'s `ai-draft` section for the actual fetch-reliability caveat). |
```
Then find the paragraph just below this table (starting "RLS enabled with an owner-only select
policy...") and add one sentence to it: "A second private bucket, `ai-draft-sources`, backs
`source_file_paths` above — same owner-scoped-RLS-as-defense-in-depth posture as `member-proofs`."

- [ ] **Step 7: Typecheck**

Run: `cd apps/backend && ./node_modules/.bin/tsc --noEmit`
Expected: still fails on the same `articles.controller.ts` import error from Task 1 (not yet
fixed) — confirm no *new* errors were introduced by the regenerated `database.types.ts`.

---

### Task 3: `AiDraftGenerationsRepository.uploadSourceFiles()`

**Files:**
- Modify: `apps/backend/src/ai/ai-draft-generations.repository.ts`

**Interfaces:**
- Consumes: `Database['public']['Tables']['ai_draft_generations']['Insert']` (already imported in this file as `AiDraftGenerationInsert`), which after Task 2 includes `source_file_paths`/`source_links`.
- Produces: `uploadSourceFiles(generationId: string, authorId: string, files: { data: Buffer; filename: string; contentType: string }[]): Promise<string[]>`, exported as a method on `AiDraftGenerationsRepository`. Task 4 calls this.

- [ ] **Step 1: Read the current file in full**

Run: `cat apps/backend/src/ai/ai-draft-generations.repository.ts`
Confirm it matches what this plan assumes: a `generations()` private accessor, an `insert()`
method that never throws (catches both the Supabase error and any thrown exception, logging via
`this.logger`). You'll add a new method alongside `insert()`, following the same never-throw
posture but for Storage uploads instead of a table insert.

- [ ] **Step 2: Add `uploadSourceFiles()`**

Add this method to the `AiDraftGenerationsRepository` class, after `insert()`:
```ts
  // Persists every prepared source file (documents and text alike) to the private
  // `ai-draft-sources` bucket, keyed by generation + author so RLS can scope access. Never
  // throws — a Storage failure must not block article generation (same posture as insert()
  // above); any file that fails to upload is simply omitted from the returned array, and the
  // audit row ends up with a partial (or empty) `source_file_paths` list rather than a blocked
  // request.
  async uploadSourceFiles(
    generationId: string,
    authorId: string,
    files: { data: Buffer; filename: string; contentType: string }[]
  ): Promise<string[]> {
    const uploaded: string[] = [];
    for (const [index, file] of files.entries()) {
      const path = `${authorId}/${generationId}/${index}-${file.filename}`;
      try {
        const { error } = await this.supabase.db.storage
          .from('ai-draft-sources')
          .upload(path, file.data, { contentType: file.contentType, upsert: false });
        if (error) {
          this.logger.warn(`Failed to upload source file "${file.filename}" to ai-draft-sources: ${error.message}`);
          continue;
        }
        uploaded.push(path);
      } catch (error) {
        this.logger.warn(
          `Failed to upload source file "${file.filename}" to ai-draft-sources`,
          error instanceof Error ? error.stack : error
        );
      }
    }
    return uploaded;
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/backend && ./node_modules/.bin/tsc --noEmit`
Expected: still only the one pre-existing `articles.controller.ts` error from Task 1. No new
errors from this file.

---

### Task 4: `AiService.generateDraft()` rewiring

**Files:**
- Modify: `apps/backend/src/ai/ai.service.ts`

**Interfaces:**
- Consumes: `PreparedSourceFile`/`prepareSourceFile` from `./prepare-source-file` (Task 1), `uploadSourceFiles()` from `AiDraftGenerationsRepository` (Task 3).
- Produces: `generateDraft(input: AiDraftRequestDto, candidateServices: {id,name}[], preparedSourceFiles: PreparedSourceFile[], authorId: string): Promise<ArticleDraftWithMetadata>` — signature change from today's `sourceFileTexts: string[]` third parameter. Task 5's controller call site must match this exactly.

- [ ] **Step 1: Update the import at the top of the file**

Find:
```ts
import { AiDraftGenerationsRepository } from './ai-draft-generations.repository';
```
Add a new import directly below it:
```ts
import type { PreparedSourceFile } from './prepare-source-file';
```

- [ ] **Step 2: Add `randomUUID` to the Node imports**

At the very top of the file, add a new first import line:
```ts
import { randomUUID } from 'node:crypto';
```

- [ ] **Step 3: Change `generateDraft()`'s signature and brief-building**

Find the current method (search for `async generateDraft(`):
```ts
  async generateDraft(
    input: AiDraftRequestDto,
    candidateServices: { id: string; name: string }[],
    sourceFileTexts: string[],
    authorId: string
  ): Promise<ArticleDraftWithMetadata> {
    const { model, tools } = this.resolveModelWithSourceLinkTool();

    const brief = [
      input.notes ? `Author's own thoughts/notes:\n${input.notes}` : null,
      input.recentDevelopments ? `Recent developments/regulations to reference:\n${input.recentDevelopments}` : null,
      input.advice ? `Advice/comments the author wants readers to take away:\n${input.advice}` : null,
      input.followUpAnswers && input.followUpAnswers.length > 0
        ? `Follow-up Q&A:\n${input.followUpAnswers.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}`
        : null,
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
      `Services available (pick only from this list, by exact name): ${candidateServices.map((s) => s.name).join(', ')}`,
      `Countries available (pick only from this list, by exact name): ${ALL_COUNTRIES.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({ model, tools, system: DRAFT_SYSTEM_PROMPT, prompt: brief });
    } catch (error) {
```

Replace the whole block above with:
```ts
  async generateDraft(
    input: AiDraftRequestDto,
    candidateServices: { id: string; name: string }[],
    preparedSourceFiles: PreparedSourceFile[],
    authorId: string
  ): Promise<ArticleDraftWithMetadata> {
    const { model, tools } = this.resolveModelWithSourceLinkTool();

    const textFiles = preparedSourceFiles.filter(
      (f): f is Extract<PreparedSourceFile, { kind: 'text' }> => f.kind === 'text'
    );
    const documentFiles = preparedSourceFiles.filter(
      (f): f is Extract<PreparedSourceFile, { kind: 'document' }> => f.kind === 'document'
    );

    const brief = [
      input.notes ? `Author's own thoughts/notes:\n${input.notes}` : null,
      input.recentDevelopments ? `Recent developments/regulations to reference:\n${input.recentDevelopments}` : null,
      input.advice ? `Advice/comments the author wants readers to take away:\n${input.advice}` : null,
      input.followUpAnswers && input.followUpAnswers.length > 0
        ? `Follow-up Q&A:\n${input.followUpAnswers.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}`
        : null,
      input.tone ? `Desired tone: ${input.tone}` : null,
      input.includeVisual
        ? 'If a comparison or breakdown is genuinely relevant to the topic, present it as a <ul>/<ol> list rather than prose (no <table> support).'
        : null,
      input.extraInstructions ? `Additional instructions: ${input.extraInstructions}` : null,
      textFiles.length > 0
        ? textFiles
            .map((f, i) => `--- Uploaded source document ${i + 1} ---\n${f.text.slice(0, 8000)}`)
            .join('\n\n')
        : null,
      input.sourceLinks && input.sourceLinks.length > 0
        ? `Source links the author wants referenced (fetch/search these if useful to ground the article):\n${input.sourceLinks.map((url) => `- ${url}`).join('\n')}`
        : null,
      `Services available (pick only from this list, by exact name): ${candidateServices.map((s) => s.name).join(', ')}`,
      `Countries available (pick only from this list, by exact name): ${ALL_COUNTRIES.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const generationId = randomUUID();

    // Persisting every uploaded file is independent of generation succeeding — fire this off
    // now so it runs concurrently with the generateText() call below rather than adding latency
    // to the member-facing response.
    const sourceFilesToPersist = preparedSourceFiles.map((f) =>
      f.kind === 'document'
        ? { data: f.data, filename: f.filename, contentType: f.mediaType }
        : { data: Buffer.from(f.text, 'utf-8'), filename: f.filename, contentType: 'text/plain' }
    );
    const sourceFilePathsPromise = this.draftGenerationsRepository.uploadSourceFiles(
      generationId,
      authorId,
      sourceFilesToPersist
    );

    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        model,
        tools,
        system: DRAFT_SYSTEM_PROMPT,
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: brief },
              ...documentFiles.map((f) => ({
                type: 'file' as const,
                data: f.data,
                mediaType: f.mediaType,
                filename: f.filename,
              })),
            ],
          },
        ],
      });
    } catch (error) {
```

- [ ] **Step 4: Await the persisted file paths and thread them into both `logGeneration()` calls**

Find the catch block directly below the code you just replaced (still inside `generateDraft()`):
```ts
    } catch (error) {
      this.logger.error('AI article draft generation failed', error instanceof Error ? error.stack : error);
      this.logGeneration(authorId, input, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        draftTitle: null,
        draftBody: null,
        sources: [],
        serviceIds: [],
        countries: [],
        state: null,
        latencyMs: Date.now() - startedAt,
      });
      throw new ServiceUnavailableException('AI drafting failed — try again or write the article manually.');
    }

    const output = await this.ensureWordCount(parseDraftResponse(result.text));
    const sources = extractSources(result.sources);
    // Taxonomy is extracted from the model's original response, before any word-count correction
    // pass — it's set once per generation, never re-derived from a correction re-prompt.
    const taxonomy = parseDraftTaxonomy(result.text, candidateServices, ALL_COUNTRIES);
    this.logGeneration(authorId, input, {
      status: 'success',
      draftTitle: output.title,
      draftBody: output.body,
      sources,
      serviceIds: taxonomy.serviceIds,
      countries: taxonomy.countries,
      state: taxonomy.state,
      latencyMs: Date.now() - startedAt,
    });

    return {
      ...output,
      sources: sources.length > 0 ? sources : null,
      serviceIds: taxonomy.serviceIds,
      countries: taxonomy.countries,
      state: taxonomy.state,
    };
  }
```

Replace it with:
```ts
    } catch (error) {
      this.logger.error('AI article draft generation failed', error instanceof Error ? error.stack : error);
      const sourceFilePaths = await sourceFilePathsPromise;
      this.logGeneration(generationId, authorId, input, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        draftTitle: null,
        draftBody: null,
        sources: [],
        serviceIds: [],
        countries: [],
        state: null,
        sourceFilePaths,
        latencyMs: Date.now() - startedAt,
      });
      throw new ServiceUnavailableException('AI drafting failed — try again or write the article manually.');
    }

    const output = await this.ensureWordCount(parseDraftResponse(result.text));
    const sources = extractSources(result.sources);
    // Taxonomy is extracted from the model's original response, before any word-count correction
    // pass — it's set once per generation, never re-derived from a correction re-prompt.
    const taxonomy = parseDraftTaxonomy(result.text, candidateServices, ALL_COUNTRIES);
    const sourceFilePaths = await sourceFilePathsPromise;
    this.logGeneration(generationId, authorId, input, {
      status: 'success',
      draftTitle: output.title,
      draftBody: output.body,
      sources,
      serviceIds: taxonomy.serviceIds,
      countries: taxonomy.countries,
      state: taxonomy.state,
      sourceFilePaths,
      latencyMs: Date.now() - startedAt,
    });

    return {
      ...output,
      sources: sources.length > 0 ? sources : null,
      serviceIds: taxonomy.serviceIds,
      countries: taxonomy.countries,
      state: taxonomy.state,
    };
  }
```

- [ ] **Step 5: Update `logGeneration()`'s signature to accept the pre-generated id and the source file paths, and log `source_links`**

Find:
```ts
  // Fire-and-forget audit log for a completed (success or failure) ai-draft attempt. Never
  // throws or blocks the caller — AiDraftGenerationsRepository.insert() catches its own errors.
  private logGeneration(
    authorId: string,
    input: AiDraftRequestDto,
    result: {
      status: 'success' | 'failed';
      errorMessage?: string;
      draftTitle: string | null;
      draftBody: string | null;
      sources: { url: string; title: string }[];
      // AI-inferred, not client-provided — there's no longer a client-sent value to log instead.
      serviceIds: string[];
      countries: string[];
      state: string | null;
      latencyMs: number;
    }
  ): void {
    void this.draftGenerationsRepository.insert({
      author_id: authorId,
      service_ids: result.serviceIds,
      countries: result.countries,
      state: result.state,
      core_answers: {
        notes: input.notes ?? null,
        recentDevelopments: input.recentDevelopments ?? null,
        advice: input.advice ?? null,
      },
      followup_questions: input.followUpQuestionsAsked ?? [],
      followup_answers: (input.followUpAnswers ?? []).map((qa) => ({
        question: qa.question,
        answer: qa.answer,
      })),
      sources: result.sources,
      tone: input.tone ?? null,
      extra_instructions: input.extraInstructions ?? null,
      draft_title: result.draftTitle,
      draft_body: result.draftBody,
      provider: process.env.AI_PROVIDER ?? null,
      model: process.env.AI_MODEL ?? null,
      status: result.status,
      error_message: result.errorMessage ?? null,
      latency_ms: result.latencyMs,
    });
  }
```

Replace it with:
```ts
  // Fire-and-forget audit log for a completed (success or failure) ai-draft attempt. Never
  // throws or blocks the caller — AiDraftGenerationsRepository.insert() catches its own errors.
  // generationId is pre-generated by generateDraft() (before this call) so it can also key the
  // already-uploaded source files in Storage — see AiDraftGenerationsRepository.uploadSourceFiles.
  private logGeneration(
    generationId: string,
    authorId: string,
    input: AiDraftRequestDto,
    result: {
      status: 'success' | 'failed';
      errorMessage?: string;
      draftTitle: string | null;
      draftBody: string | null;
      sources: { url: string; title: string }[];
      // AI-inferred, not client-provided — there's no longer a client-sent value to log instead.
      serviceIds: string[];
      countries: string[];
      state: string | null;
      sourceFilePaths: string[];
      latencyMs: number;
    }
  ): void {
    void this.draftGenerationsRepository.insert({
      id: generationId,
      author_id: authorId,
      service_ids: result.serviceIds,
      countries: result.countries,
      state: result.state,
      core_answers: {
        notes: input.notes ?? null,
        recentDevelopments: input.recentDevelopments ?? null,
        advice: input.advice ?? null,
      },
      followup_questions: input.followUpQuestionsAsked ?? [],
      followup_answers: (input.followUpAnswers ?? []).map((qa) => ({
        question: qa.question,
        answer: qa.answer,
      })),
      sources: result.sources,
      source_file_paths: result.sourceFilePaths,
      source_links: input.sourceLinks ?? [],
      tone: input.tone ?? null,
      extra_instructions: input.extraInstructions ?? null,
      draft_title: result.draftTitle,
      draft_body: result.draftBody,
      provider: process.env.AI_PROVIDER ?? null,
      model: process.env.AI_MODEL ?? null,
      status: result.status,
      error_message: result.errorMessage ?? null,
      latency_ms: result.latencyMs,
    });
  }
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/backend && ./node_modules/.bin/tsc --noEmit`
Expected: still only the one pre-existing `articles.controller.ts` error from Task 1 (its call
site still passes the old `sourceFileTexts: string[]` shape — Task 5 fixes this next). If you see
*any* other new error in `ai.service.ts` itself, stop and resolve it before continuing — it means
one of the edits above doesn't match the file's actual current state exactly; re-read the file and
adjust.

---

### Task 5: Controller wiring

**Files:**
- Modify: `apps/backend/src/articles/articles.controller.ts`

**Interfaces:**
- Consumes: `prepareSourceFile` from `../ai/prepare-source-file` (Task 1), `generateDraft()`'s new signature from `AiService` (Task 4).

- [ ] **Step 1: Update the import**

Find:
```ts
import { extractSourceFileText } from '../ai/extract-text';
```
Replace with:
```ts
import { prepareSourceFile, type PreparedSourceFile } from '../ai/prepare-source-file';
```

- [ ] **Step 2: Update the multipart-parsing loop in `aiDraft()`**

Find (inside `async aiDraft(...)`):
```ts
    let payload: string | undefined;
    const sourceFileTexts: string[] = [];

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        sourceFileTexts.push(await extractSourceFileText(buffer, part.filename));
      } else if (part.fieldname === 'payload') {
        payload = part.value as string;
      }
    }
```
Replace with:
```ts
    let payload: string | undefined;
    const preparedSourceFiles: PreparedSourceFile[] = [];

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        preparedSourceFiles.push(await prepareSourceFile(buffer, part.filename));
      } else if (part.fieldname === 'payload') {
        payload = part.value as string;
      }
    }
```

- [ ] **Step 3: Update the call site at the end of `aiDraft()`**

Find:
```ts
    const categories = await this.categoriesService.list();
    const candidateServices = categories.flatMap((c) => c.services.map((s) => ({ id: s.id, name: s.name })));
    return this.aiService.generateDraft(dto, candidateServices, sourceFileTexts, user.id);
```
Replace with:
```ts
    const categories = await this.categoriesService.list();
    const candidateServices = categories.flatMap((c) => c.services.map((s) => ({ id: s.id, name: s.name })));
    return this.aiService.generateDraft(dto, candidateServices, preparedSourceFiles, user.id);
```

- [ ] **Step 4: Typecheck the whole backend**

Run: `cd apps/backend && ./node_modules/.bin/tsc --noEmit`
Expected: clean, zero errors.

- [ ] **Step 5: Lint the changed files**

Run: `cd apps/backend && npx eslint src/ai/prepare-source-file.ts src/ai/ai-draft-generations.repository.ts src/ai/ai.service.ts src/articles/articles.controller.ts`
Expected: clean, zero errors.

---

### Task 6: Update `docs/rest-api.md`

**Files:**
- Modify: `docs/rest-api.md`

- [ ] **Step 1: Rewrite the `ai-draft` request paragraph**

Find this paragraph (search for "Why multipart"):
```
**Request:** `multipart/form-data`, not JSON — a `payload` field carrying the
`AiDraftArticleRequest` shape (see `packages/shared-types/article.ts`) as a JSON string, plus zero
or more `files` parts (the wizard's source-document dropzone; PDF/DOCX/TXT). Why multipart: the
JSON-only fields (`notes`, `recentDevelopments`, `advice`, `followUpAnswers`,
`followUpQuestionsAsked`, `sourceLinks`, `includeVisual`, `tone`, `extraInstructions`) needed to
travel alongside real file uploads in one request, same reasoning as the membership-application
photo upload endpoint. No `title`/`serviceIds`/`countries`/`state` — the model infers all four
(see Response below) rather than the member picking them beforehand; `notes`/`advice` stay
optional at the DTO level, matching the existing pattern where the real "must be filled in"
enforcement is the wizard's own step-1 gate, not a hard server requirement. Source files are
extracted to text server-side (`pdf-parse` for PDF, `mammoth` for DOCX, raw UTF-8 for TXT;
magic-byte checked via `file-type` first, per root CLAUDE.md's non-negotiable upload rule) and
**never persisted** — used once to build this one prompt, then discarded. The model has
web-search/fetch access via the currently-configured `AI_PROVIDER`'s own hosted web tool (see
`AiService.resolveModelWithSourceLinkTool`), but only OpenAI's `webSearch` tool actually searches
the open web and reliably produces the `sources` citations below — Anthropic's
`webFetch_20260209` can only fetch URLs it's already given (the member's `sourceLinks`, or ones
the model finds some other way), not search for new ones, and Google's `urlContext` doesn't
populate `sources` without Search grounding separately configured (not done here). Open,
unprompted research and reliable citations are effectively an OpenAI-only capability today; on
the other two providers this behaves closer to the old `sourceLinks`-only fetch behavior. This
replaced an earlier server-side fetch (`apps/backend/src/ai/fetch-safe.ts`, since deleted) that
had a DNS-rebinding SSRF gap — moving the fetch to the provider's own infrastructure removes that
vulnerability class outright rather than patching it. Same `@Roles('member')` posture as
`POST /v1/articles`.
```
Replace it with:
```
**Request:** `multipart/form-data`, not JSON — a `payload` field carrying the
`AiDraftArticleRequest` shape (see `packages/shared-types/article.ts`) as a JSON string, plus zero
or more `files` parts (the wizard's source-document dropzone; PDF, JPEG, PNG, WebP, or TXT — DOCX
is not supported, see below). Why multipart: the JSON-only fields (`notes`, `recentDevelopments`,
`advice`, `followUpAnswers`, `followUpQuestionsAsked`, `sourceLinks`, `includeVisual`, `tone`,
`extraInstructions`) needed to travel alongside real file uploads in one request, same reasoning
as the membership-application photo upload endpoint. No `title`/`serviceIds`/`countries`/`state`
— the model infers all four (see Response below) rather than the member picking them beforehand;
`notes`/`advice` stay optional at the DTO level, matching the existing pattern where the real
"must be filled in" enforcement is the wizard's own step-1 gate, not a hard server requirement.

PDF and image uploads are sent to the model as **native documents** (`apps/backend/src/ai/
prepare-source-file.ts`, magic-byte checked via `file-type` first, per root CLAUDE.md's
non-negotiable upload rule) — raw bytes, no text extraction, no fidelity loss, so tables/layout/
charts in a source document are preserved. TXT uploads stay on the previous behavior: embedded as
literal text in the prompt (capped at 8,000 characters per file). DOCX is not accepted — members
export to PDF first; this was a deliberate choice over embedding a document-conversion engine
(LibreOffice) in the backend, given the ongoing CPU/memory/image-size cost that would add for no
real usage data yet to justify it.

**Every uploaded file is persisted** to a private Supabase Storage bucket (`ai-draft-sources`,
see `docs/database-erd.md`), linked to the `ai_draft_generations` audit row that also now logs the
member's pasted `sourceLinks` — both purely for traceability of what an article was actually
generated from; neither changes what the model receives in the request itself.

The model has web-search/fetch access via the currently-configured `AI_PROVIDER`'s own hosted web
tool (see `AiService.resolveModelWithSourceLinkTool`), but only OpenAI's `webSearch` tool actually
searches the open web and reliably produces the `sources` citations below — Anthropic's
`webFetch_20260209` can only fetch URLs it's already given (the member's `sourceLinks`, or ones
the model finds some other way), not search for new ones, and Google's `urlContext` doesn't
populate `sources` without Search grounding separately configured (not done here). Open,
unprompted research and reliable citations are effectively an OpenAI-only capability today; on
the other two providers this behaves closer to the old `sourceLinks`-only fetch behavior. Same
`@Roles('member')` posture as `POST /v1/articles`.
```

- [ ] **Step 2: Typecheck is not applicable to a markdown-only change — skip straight to review**

Read back the edited section once (`sed -n '402,460p' docs/rest-api.md` or open the file) and
confirm it reads coherently end-to-end and doesn't contradict anything else in the same section
(the `followUpAnswers`/Response paragraphs directly below it are unchanged and should still make
sense immediately after this rewritten paragraph).

---

### Task 7: Verification

**Files:** none (manual verification only — no automated test suite exists in this repo, see
Global Constraints)

- [ ] **Step 1: Start the backend**

Run: `cd apps/backend && pnpm dev` (or however this repo's existing dev workflow starts it — check
`apps/backend/package.json`'s `dev` script if unsure). Confirm it boots without error — a boot
failure here most likely means `database.types.ts` (Task 2) or one of the `ai.service.ts`/
`articles.controller.ts` edits (Tasks 4-5) has a mismatch; do not proceed until it's running
clean.

- [ ] **Step 2: Multipart request with a real PDF, a real image, and a TXT file**

Using Postman (import `postman/Expertly.postman_collection.json`, sign in via its `Auth
(Supabase) → Sign in` request first per `postman/README.md`) or `curl`, send `POST
/v1/articles/ai-draft` with:
- a `payload` field: `{"notes":"Test note for source-document verification.","advice":"Test advice."}`
- three `files` parts: one real PDF, one real JPEG or PNG, one `.txt` file with a few lines of
  text.

Expected: `201`, response includes `title`/`body` and (if the model inferred any) `serviceIds`/
`countries`/`state`.

- [ ] **Step 3: Confirm the files were persisted**

Open the Supabase dashboard → Storage → `ai-draft-sources` bucket. Confirm a new folder
`<your-user-id>/<some-uuid>/` exists with three objects inside, named `0-<pdf filename>`,
`1-<image filename>`, `2-<txt filename>` (order matches the order the files were sent in the
multipart request).

- [ ] **Step 4: Confirm the audit row**

In the Supabase dashboard → Table Editor → `ai_draft_generations`, find the newest row (or filter
by the uuid from the folder name in Step 3, which is also this row's `id`). Confirm
`source_file_paths` contains exactly the three Storage paths from Step 3, and `source_links` is
`[]` (empty, since this test request didn't include any `sourceLinks`).

- [ ] **Step 5: Confirm DOCX is still rejected**

Send the same request as Step 2, but swap one `files` part for a real `.docx` file. Expected:
`400`, with a message naming that file as an unsupported type — same shape as before this plan's
changes (not a new error path, per the spec's explicit decision to drop DOCX entirely rather than
convert it).

- [ ] **Step 6: Update `postman/Expertly.postman_collection.json` if its `ai-draft` request's
  description mentions supported file types**

Run: `grep -n "PDF/DOCX/TXT\|PDF, DOCX" postman/Expertly.postman_collection.json`
If this returns a match in the `ai-draft` request's description, update it to say "PDF, JPEG, PNG,
WebP, or TXT" instead, matching `docs/rest-api.md`'s Task 6 wording. If it returns no match, no
change is needed here — note that in your final report rather than editing something that doesn't
exist.
