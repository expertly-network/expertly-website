# AI Draft — Native Source Documents & Persistence — Design Spec

**Status:** Approved in brainstorming, not yet implemented.

**Scope:** Builds on top of `docs/superpowers/specs/2026-10-04-ai-inferred-article-taxonomy-design.md`
and the original `docs/superpowers/specs/2026-10-03-adaptive-article-ai-flow-design.md`, both
implemented but not yet committed (sitting as an uncommitted diff on local `main` as of this
writing). This spec assumes that work exists and extends it. Backend-only — per root `CLAUDE.md`'s
session split, no backend contract changes: the `POST /v1/articles/ai-draft` request/response
shape is unchanged (same multipart `files` field, same `AiDraftArticleRequest`/
`AiDraftArticleResponse` shapes), so `packages/shared-types` is untouched. One small frontend
follow-up is flagged in §8 for a separate session.

## 1. Why

Today, uploaded source files (PDF/DOCX/TXT) are parsed into plain text server-side
(`pdf-parse`/`mammoth`) and pasted into the AI prompt, truncated to 8,000 characters per file. This
is lossy — tables, charts, embedded images, and layout are gone before the model ever sees them —
and the files themselves are discarded after the request, so there's no record of what an article
was actually generated from. This spec: (1) hands PDFs **and images** to the AI as native
documents instead of extracted text; (2) persists every uploaded file, linked to the existing
`ai_draft_generations` audit row, so "what was this article generated from" is answerable later.

## 2. Resolved decisions (from brainstorming)

- **DOCX uploads are dropped — PDF only (+ TXT, unchanged).** DOCX→PDF conversion was considered
  (LibreOffice embedded in the backend's Docker image) but rejected: it would add a few hundred MB
  to the image, switch the runtime base off Alpine, and cost real CPU/memory per conversion
  (LibreOffice spins up a full process per file, commonly several seconds and a few hundred MB of
  RAM) — an ongoing operational cost, not a one-time one, for a pre-production app with no real
  traffic yet to justify it. Members with a DOCX export it to PDF themselves before uploading (a
  one-click operation in Word/Google Docs/Pages) — a small, one-time, well-understood ask. This can
  be revisited later if members actually request DOCX support once real usage patterns are known.
- **A DOCX (or any other unsupported type) upload is rejected exactly as it already is today** —
  `BadRequestException`, unchanged behavior, no new error path needed.
- **Images are supported alongside PDFs, via the same native-document mechanism** — JPEG, PNG, and
  WebP are sent to the AI as native images (all three configured providers, including the
  `gpt-4o-mini` running today, have native vision support), not text-extracted (there was never a
  text-extraction path for images to begin with). No new infra cost — same `FilePart` input, same
  private Storage bucket, just a different `mediaType`. Provider-side per-image size/pixel limits
  (sometimes tighter than our blanket 15MB cap) aren't specially validated for — left to surface
  naturally as a provider error if ever hit, rather than over-building validation for a case that
  may never occur in practice.
- **Every uploaded file is persisted** — PDFs, images, and TXT files all get saved to Storage, not
  just the ones sent natively to the AI.
- **Pasted `sourceLinks` (URLs, not files) are now also logged** on the audit row for traceability,
  as a plain array — this does **not** change whether the AI actually fetches/reads those URLs,
  which stays exactly as today (best-effort, depends on the configured `AI_PROVIDER`'s own hosted
  web tool — see `docs/rest-api.md`'s existing `ai-draft` section). Logging and fetching are
  independent; this spec only adds the former.
- **Follow-up Q&A persistence needs no new work** — `ai_draft_generations.followup_questions`/
  `followup_answers` (added in the taxonomy spec above) already cover "the questions and answers
  the member has done."
- **Storage upload failures never block generation** — folded into the existing fire-and-forget
  audit path (`AiDraftGenerationsRepository.insert()` already never throws).
- **No new admin-facing read endpoint** for the stored source files — same posture as the rest of
  `ai_draft_generations` today (Supabase dashboard directly; a real admin view is tracked as
  beyond-roadmap work in `master-tdd.md`).
- **No Docker/infra change of any kind** — this entire feature now lives inside the existing
  `node:22-alpine` image, no new system dependency.

## 3. Document preparation — `extract-text.ts` → `prepare-source-file.ts`

`apps/backend/src/ai/extract-text.ts` is renamed to `apps/backend/src/ai/prepare-source-file.ts`
and its responsibility changes from "extract text from every file" to "prepare each file for its
actual destination" — PDFs and images become native documents, everything else that isn't
recognized as text stays rejected exactly as today:

```ts
const SUPPORTED_DOCUMENT_MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type SupportedDocumentMediaType = (typeof SUPPORTED_DOCUMENT_MEDIA_TYPES)[number];

export type PreparedSourceFile =
  | { kind: 'document'; mediaType: SupportedDocumentMediaType; data: Buffer; filename: string }
  | { kind: 'text'; text: string; filename: string };

export async function prepareSourceFile(buffer: Buffer, filename: string): Promise<PreparedSourceFile>
```

Behavior per sniffed MIME type (via `file-type`, unchanged from today):
- `application/pdf`, `image/jpeg`, `image/png`, or `image/webp` → `{ kind: 'document', mediaType:
  <the sniffed type>, data: buffer, filename }` — passed through untouched, no parsing, no
  conversion.
- No sniffed type (plain text) → `{ kind: 'text', text: buffer.toString('utf-8'), filename }`,
  exactly as today.
- Anything else (DOCX, SVG, HEIC, GIF, or any other unrecognized type) → `BadRequestException`,
  unchanged from today — DOCX simply moves from "supported via mammoth" to "not a supported type,"
  same error shape as any other rejected type already gets.

`MAX_SOURCE_FILE_BYTES` (15MB per file) check stays, applied before any parsing, same as today.

**Dependencies:** `pdf-parse` and `mammoth` become unused (confirmed — grepped, nowhere else in
the codebase) and are removed from `apps/backend/package.json`.

## 4. `AiService.generateDraft()` rewiring

**Controller (`articles.controller.ts`):** the multipart-parsing loop is unchanged in shape; it now
calls `prepareSourceFile()` per file instead of `extractSourceFileText()`, collecting
`PreparedSourceFile[]` instead of `string[]`.

**`generateDraft()` signature:** `sourceFileTexts: string[]` → `preparedSourceFiles:
PreparedSourceFile[]`. Brief-building splits by `kind`:
- `kind: 'text'` entries: unchanged from today — embedded as literal text in the brief string,
  same `--- Uploaded source document N ---` framing, same 8,000-char cap per file (that cap was
  about overall prompt size, unrelated to this change, so it stays as-is).
- `kind: 'document'` entries (PDFs and images): become `FilePart` content items, no truncation —
  the whole document/image goes to the model.

**The `generateText()` call's `prompt` changes from a bare string to the `ai` SDK's
array-of-messages form** (its `Prompt` type is `prompt: string | Array<ModelMessage>` — confirmed
in `@ai-sdk/provider-utils`'s types; same call, not a different SDK surface):
```ts
const documentFiles = preparedSourceFiles.filter(
  (f): f is Extract<PreparedSourceFile, { kind: 'document' }> => f.kind === 'document'
);

const result = await generateText({
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
```
`model`, `tools`, `system` are untouched. `ensureWordCount()`'s correction pass is unaffected — it
only re-prompts against the already-generated `{title, body}` text, never re-attaches documents.

**No new size validation needed** — `MAX_SOURCE_FILE_BYTES` (15MB, checked in
`prepare-source-file.ts`) already sits comfortably under OpenAI/Anthropic/Google's
inline-document limits.

## 5. Storage: new private bucket + schema columns

**New Supabase Storage bucket**, added to `supabase/migrations/0004_tables.sql` (same file, per
this repo's pre-production single-schema convention — not a new numbered migration), following the
existing `member-proofs` private-bucket pattern exactly:
```sql
insert into storage.buckets (id, name, public)
values ('ai-draft-sources', 'ai-draft-sources', false)
on conflict (id) do nothing;

create policy ai_draft_sources_owner_rw
  on storage.objects for all
  using (bucket_id = 'ai-draft-sources' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ai-draft-sources' and (storage.foldername(name))[1] = auth.uid()::text);
```
Private — these are raw member-uploaded documents, potentially containing confidential client
material, so no permanent public URL. Only the backend's service-role client writes here (bypasses
RLS); the owner-scoped policy is the same defense-in-depth posture as every other table/bucket in
this schema. Objects keyed `<authorId>/<generationId>/<n>-<original filename>` — whatever the
original upload's extension was (`.pdf`, `.jpg`/`.png`/`.webp`, or `.txt`); no conversion ever
happens.

**Schema changes to `ai_draft_generations`** (same migration file, two additive columns):
```sql
alter table public.ai_draft_generations
  add column source_file_paths text[] not null default '{}',
  add column source_links text[] not null default '{}';
```
`docs/database-erd.md` documents both as audit-only, same no-FK posture as the table's existing
`service_ids` column. `source_file_paths`: Storage object paths within `ai-draft-sources` for every
file the member uploaded in this attempt. `source_links`: the pasted `sourceLinks` URLs as given —
traceability only, does not imply the AI actually fetched any of them (see §2).

**Why a pre-generated id, not insert-then-update:** `AiService.generateDraft()` currently builds
the audit row only after the whole generation finishes (success or fail). To key storage paths
before that row exists, the service generates `const generationId = randomUUID()` (Node's built-in
`crypto`, no new dependency) up front, uploads files under that id, and passes that same id as the
row's explicit `id` on insert (Postgres accepts an app-supplied value even though the column has a
default `gen_random_uuid()`). File persistence and the AI call are independent and can run
concurrently — persistence doesn't wait on generation, and vice versa.

**New repository method** on the existing `AiDraftGenerationsRepository`
(`apps/backend/src/ai/ai-draft-generations.repository.ts`, built in the earlier adaptive-flow
session) rather than a new file — same resource area as the audit-row insert it already owns:
```ts
async uploadSourceFiles(
  generationId: string,
  authorId: string,
  files: { data: Buffer; filename: string; contentType: string }[]
): Promise<string[]>
```
Mirrors the existing `ApplicationsRepository.uploadFile()` pattern
(`this.supabase.db.storage.from('ai-draft-sources').upload(path, buffer, { contentType, upsert:
false })`), but never throws — on any upload error it logs a warning (same `Logger` instance
already in this repository) and omits that file's path from the returned array, per §2's "upload
failures never block generation."

**Called with every prepared file, not just the document ones** — per §2's "every uploaded file is
persisted," `AiService.generateDraft()` builds the `files` argument from the full
`preparedSourceFiles` array, not the `documentFiles` subset used for the AI prompt in §4:
`kind: 'document'` entries pass their `data`/`filename` through as-is with `contentType: f.mediaType`
(so a PDF stays `application/pdf`, an image keeps its actual sniffed type); `kind: 'text'` entries
are re-encoded (`Buffer.from(f.text, 'utf-8')`) with `contentType: 'text/plain'`. This call can run
concurrently with the `generateText()` call (§4) — persistence and generation don't block each
other.

## 6. Error handling summary

| Failure | Behavior |
|---|---|
| Unsupported file type uploaded (DOCX, SVG, HEIC, etc.) | `400`, same existing error shape — unchanged from today. |
| A Storage upload fails | Logged as a warning; generation proceeds; that file's path is simply missing from `source_file_paths`. |
| The AI call itself fails | Unchanged from today — `ServiceUnavailableException`, audit row still written with `status: 'failed'`, now also carrying whatever `source_file_paths`/`source_links` were captured before the failure. |

## 7. Explicitly out of scope

- `sourceLinks` fetch/read reliability — unchanged, still provider-dependent best-effort (see
  `docs/rest-api.md`'s existing `ai-draft` section). Only the *logging* of which links were pasted
  is new here.
- Any new admin UI/endpoint to browse stored source files.
- DOCX support of any kind (conversion or otherwise) — explicitly dropped, see §2. Revisit with a
  fresh cost/benefit discussion if members actually ask for it.
- Re-deriving source-file handling for `ai-refine` — refine never took source files to begin with
  (unchanged).

## 8. Docs/contract impact

No `AiDraftArticleRequest`/`AiDraftArticleResponse` shape change — `packages/shared-types` and
Postman need no structural edits. `docs/rest-api.md`'s current line ("Source files are extracted to
text server-side... and never persisted") becomes false and must be rewritten to describe the new
native-input + persisted-to-storage behavior, and its mention of supported upload types
(`PDF/DOCX/TXT`) becomes `PDF/JPEG/PNG/WebP/TXT`. `docs/database-erd.md` gets the new bucket and
the two new `ai_draft_generations` columns documented in its existing section for that table.

**Flagged for a separate frontend session (not this one):** `AiDraftWizard.tsx`'s file input currently
has `accept=".doc,.docx,.pdf,.txt"` — once the backend rejects DOCX and accepts images, that hint
should become `.pdf,.txt,.jpg,.jpeg,.png,.webp`, so a member isn't invited to pick a file that will
then fail server-side, and can discover image upload is now possible. Small, client-visible,
correctly belongs in a frontend session per root `CLAUDE.md`'s session split, not bundled into this
backend change.

## 9. Verification (backend-only, per this repo's session-split convention)

curl/Postman multipart `ai-draft` request carrying a real PDF, a real JPEG/PNG, and a TXT file —
confirm `201`, then check the Supabase dashboard: the `ai-draft-sources` bucket has three new
objects under `<authorId>/<generationId>/`, and the `ai_draft_generations` row's
`source_file_paths`/`source_links` are populated correctly. Separately, upload a DOCX and confirm
it still gets the same `400` unsupported-file-type response as before this change.

## 10. Phased plan

1. `apps/backend/src/ai/prepare-source-file.ts` (renamed from `extract-text.ts`) —
   `prepareSourceFile()`, `PreparedSourceFile` type, image MIME sniffing (JPEG/PNG/WebP) added
   alongside PDF, DOCX now falls into the existing unsupported-type rejection. Remove
   `pdf-parse`/`mammoth` from `apps/backend/package.json`.
2. `supabase/migrations/0004_tables.sql` — `ai-draft-sources` bucket + RLS policy,
   `source_file_paths`/`source_links` columns on `ai_draft_generations`. Regenerate
   `apps/backend/src/supabase/database.types.ts`.
3. `apps/backend/src/ai/ai-draft-generations.repository.ts` — add `uploadSourceFiles()`.
4. `apps/backend/src/ai/ai.service.ts` — `generateDraft()` rewired per §4/§5 (prepared-files
   param, native `FilePart` prompt construction, pre-generated `generationId`, `source_links`
   logging).
5. `apps/backend/src/articles/articles.controller.ts` — multipart loop calls
   `prepareSourceFile()` instead of `extractSourceFileText()`.
6. Update `docs/rest-api.md` (§8) and `docs/database-erd.md` (§8) in the same change.
7. Verify per §9.
