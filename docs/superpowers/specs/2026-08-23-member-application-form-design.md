# Member Application Form — Design Spec

**Status:** Approved for implementation (2026-08-23)
**Scope:** Backend + frontend for the full membership application lifecycle: resumable draft,
LinkedIn-import boundary, file storage, and admin approve/reject. Built in one session per explicit
user instruction — a deliberate exception to root `CLAUDE.md`'s usual backend/frontend session
split, since the whole point is a locally reviewable, working build before anything is pushed.

## 1. Current state (what already exists, uncommitted, local)

- `/apply` route, 5-step wizard (LinkedIn URL capture → Identity → Background → Services & Rates →
  Review), frontend-only state (`useState`), lost on refresh.
- `POST /v1/applications` — single-shot create, full validation, immutable snapshot semantics.
- `GET /v1/applications/me` — owner's most recent application.
- Both application entry points already work: Apply Now CTAs → `/apply`; the member-intent
  LinkedIn OAuth signup flow (`app/auth/callback/route.ts`) already redirects a non-member to
  `/apply` post-auth. Email/password signup (`SignUpForm.tsx`) always redirects to `returnTo`
  (default `/`) regardless of intent — this is unchanged by this spec; `AuthCard`'s `mode ===
  'member'` tab only offers LinkedIn OAuth (no email form), so the existing member-intent path
  already covers "member signup → application form."
- Schema: `membership_applications` table, `application_status` enum (`submitted`,
  `under_review`, `approved`, `rejected`), designed and commented as an **immutable snapshot
  written once at submit** — this is the design principle this spec must relax without breaking.
- `docs/rest-api.md` / `docs/database-erd.md` document all of the above as "✅ Built"; admin
  review is explicitly listed there as deferred (columns exist: `reviewed_by`, `reviewed_at`,
  `rejection_reason`).
- Proven pattern to reuse: `members.service.ts`'s `requestUpload` — signed-upload-URL flow against
  a private `member-proofs` Storage bucket, RLS-scoped to `auth.uid()`. (Note: this existing flow
  does **not** do magic-byte MIME validation — see §6 for why this spec's upload endpoint diverges
  from that pattern for correctness.)
- `manageApplications` already exists as an admin permission (`admin-permissions.ts`), used today
  only by the `reviewer` role — the guard infrastructure (`@RequirePermission`,
  `AdminPermissionGuard`) needs no changes.
- **Flagged, not fixed:** `apps/backend/src/main.ts` bootstraps with `NestFactory.create(AppModule)`
  using `@nestjs/platform-express` (confirmed in `package.json` — no `@nestjs/platform-fastify`
  dependency), contradicting root `CLAUDE.md`'s non-negotiable "NestJS backend uses Fastify adapter
  (not Express)" rule. This is pre-existing in the uncommitted codebase, not introduced by this
  spec. Out of scope to fix here (unrelated to the application form); the file-upload design below
  is written against what's actually running (Express + `multer`), not the documented ideal.

## 2. What this spec adds

1. Resumable, backend-persisted draft (replaces frontend-only wizard state).
2. A pluggable LinkedIn-import boundary (mock provider now, n8n-backed provider later, zero
   frontend/contract change on swap).
3. Real file storage for the application photo (and an extensible, generic document slot) via a
   new private Storage bucket, magic-byte-validated.
4. Admin approve/reject endpoint (backend only, no UI — see §7 for why) that provisions
   `member_profiles`/`member_services` and flips `profiles.role` to `member`.
5. A visual redesign of the wizard (same 5-step structure — it's already correctly grouped) to a
   more premium, senior-designer presentation, strictly within `docs/design-system.md` tokens.

## 3. Data model — migration `0005_application_drafts.sql`

```sql
alter type public.application_status add value 'draft' before 'submitted';

alter table public.membership_applications
  alter column first_name drop not null,
  alter column last_name drop not null,
  alter column contact_email drop not null,
  alter column region drop not null,
  alter column country drop not null,
  alter column linkedin_url drop not null,
  alter column bio drop not null,
  alter column years_of_experience drop not null,
  alter column rate_min_cents drop not null,
  alter column rate_max_cents drop not null,
  alter column billing_period drop not null,
  alter column background_check_consent drop not null,
  alter column status set default 'draft',
  add column current_step smallint not null default 1,
  add column photo_path text,
  add column documents jsonb not null default '[]' check (jsonb_typeof(documents) = 'array');

comment on column public.membership_applications.photo_path is
  'Private Storage path (application-assets bucket), not a public URL. Signed URL minted at read
   time by ApplicationsService.toDto(). Superseded photo_url text column intent — same concept,
   renamed because it now holds a path, not a URL.';
comment on column public.membership_applications.documents is
  'jsonb array of {id, filename, path, mimeType, sizeBytes, uploadedAt}. Generic/extensible for
   future document types; only the profile photo has upload UI in this iteration.';
```

Note: `photo_url` (existing column) is dropped in the same migration in favor of `photo_path`,
since nothing has shipped against the old column yet (uncommitted module — see §1). `toDto()`
still emits a field named `photoUrl` on the wire (a signed URL, minted at read time) — the
shared-types contract name doesn't change, only its backing storage.

```sql
alter table public.membership_applications drop column photo_url;
```

Completeness for `submitted` is enforced in `ApplicationsService`, not by a DB constraint — this
matches the existing convention (cross-field/business validation lives in the service layer, per
`apps/backend/CLAUDE.md`).

## 4. Backend API surface

All routes owner-scoped via `@CurrentUser()`, no id in the URL (mirrors the existing
`GET /v1/applications/me` convention) except the admin route.

### `POST /v1/applications/me` 🔒 — save-or-submit (upsert)

Replaces the old `POST /v1/applications`. Body: `UpdateApplicationDto` — every field from the old
`CreateApplicationDto` becomes `@IsOptional()`, plus a new `status?: 'draft' | 'submitted'`
(defaults to `'draft'` when omitted).

Behavior:
- No existing row for caller → create one (`status: 'draft'` unless the first call already sends
  `status: 'submitted'` with a complete body — both paths go through the same code, see below).
- Existing `draft` row → merge the incoming fields into it (`current_step` updated if sent).
- Existing `submitted`/`under_review`/`approved`/`rejected` row → `409 Conflict`, same
  dedup rule as today (`applicant_id` + status `in (submitted, under_review)` — extend the check
  to also cover `approved`, since a member shouldn't be able to open a second application either).
- `status: 'submitted'` in the body → after merging fields, run the **exact same validation
  `CreateApplicationDto` runs today** (all fields required, rate range, practice-area
  existence/active check) against the merged row, compute `selectedTier` / `listPriceCents` /
  coupon / `discountAmountCents` / `amountDueCents` / `paymentStatus` (same logic as today's
  `create()`), set `status: 'submitted'`.
- Returns `ApplicationDto` (200) in both cases — no separate 201-vs-200 distinction needed, this
  isn't a pure-REST resource-creation semantic.

**Trade-off flagged and accepted (per user):** this endpoint creates on first call and updates on
repeat calls under the same POST URL, which isn't strict REST idempotency — accepted deliberately
for a singleton-per-user resource, discussed and approved in brainstorming.

### `GET /v1/applications/me` 🔒 — unchanged shape/behavior

Already returns the most recent row regardless of status — works for `draft` rows with no change.
Response DTO: `photoUrl` and each `documents[].url` are freshly minted signed URLs (short TTL,
e.g. 1 hour) computed in `toDto()`, not stored.

### `POST /v1/applications/me/uploads` 🔒 — see §6

### `POST /v1/applications/me/linkedin-import` 🔒 — see §5

### `PATCH /v1/admin/applications/:id` 🛡️ `manageApplications` — see §7

## 5. LinkedIn import boundary

```typescript
// applications/linkedin-import/linkedin-import.provider.ts
export interface LinkedInImportResult {
  firstName?: string;
  lastName?: string;
  bio?: string;
  yearsOfExperience?: number;
  workExperiences?: WorkExperienceInput[];
  educations?: EducationInput[];
  country?: string;
  city?: string;
}

export abstract class LinkedInImportProvider {
  abstract importProfile(linkedinUrl: string): Promise<LinkedInImportResult>;
}
```

`MockLinkedInImportProvider implements LinkedInImportProvider` — deterministic, not random: derive
a display name from the URL's `/in/<slug>` segment (title-case the slug), return a fixed sample
bio/one work experience/one education, and **deliberately omit** `country`/`city`/`yearsOfExperience`
so the "ask user to fill what couldn't be imported" UX is exercised for real, not just claimed.

Registered as the `LinkedInImportProvider` DI token in `applications.module.ts`. Swapping to a real
n8n-backed provider later is a one-file change (new class implementing the same interface,
swap the provider binding) — no controller, DTO, or frontend change.

`POST /v1/applications/me/linkedin-import` — body `{linkedinUrl: string}` (`@IsUrl()`), calls
`provider.importProfile(linkedinUrl)`, returns the result directly. **Does not write to the
draft.** The frontend merges the result into wizard state (client-side only, tags which fields came
from import for the subtle UI badge in §8) and persists it through the normal
`POST /v1/applications/me` save call — one write path for both manual and imported data, per the
brief's "LinkedIn import is a pre-population mechanism, not a separate application type."

## 6. File storage

New private bucket `application-assets` (migration, same RLS pattern as `member-proofs`):

```sql
insert into storage.buckets (id, name, public) values ('application-assets', 'application-assets', false);

create policy application_assets_owner_all
  on storage.objects for all
  using (bucket_id = 'application-assets' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'application-assets' and (storage.foldername(name))[2] = auth.uid()::text);
```

Path convention: `members/application/{applicantId}/profile-photo.<ext>` (deterministic,
`upsert: true` — replacing a photo overwrites, no orphaned duplicates) and
`members/application/{applicantId}/document-{n}.<ext>` (n increments per existing `documents`
array length). `storage.foldername(name)[2]` is the applicant id because `[1]` is the fixed
`application` segment — matches the brief's `assets/members/application/{profileId}/...`
hierarchy.

**Why this endpoint proxies the upload instead of issuing a signed upload URL** (unlike
`members.service.ts`'s `requestUpload`): root `CLAUDE.md`'s non-negotiable rule is "File uploads:
always validate MIME type using `file-type` (magic bytes)." A signed-upload-URL flow never puts
the file's bytes through the backend, so magic-byte validation is structurally impossible there —
confirmed that's exactly why the existing `member-proofs` flow only validates a client-declared
`contentType` string, not actual bytes. For this new endpoint, bytes must pass through the API so
the rule can actually be enforced:

```
POST /v1/applications/me/uploads   (multipart/form-data)
  fields: kind ('photo' | 'document'), file
```

Implementation: `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: ... } }))` from
`@nestjs/platform-express` (matches the app's actual running adapter — see §1's flag) + `multer`
memory storage. Backend reads the buffer, runs `file-type`'s `fileTypeFromBuffer()`, rejects
(`400`) if the sniffed type isn't in the allow-list for `kind`:
- `photo`: `image/jpeg`, `image/png`, max 5 MB (matches `apply.html`'s
  `accept="image/jpeg,image/png"`).
- `document`: `image/jpeg`, `image/png`, `application/pdf`, max 15 MB.

On success: uploads the buffer to `application-assets` at the deterministic path via the
service-role Supabase client, updates `photo_path` (photo) or appends to `documents` jsonb
(document) on the caller's draft row, returns the updated `ApplicationDto`.

New dependencies: `file-type` (backend `dependencies`), `@types/multer` (backend `devDependencies`
— `multer` itself ships as a transitive dep of `@nestjs/platform-express`, confirm at
implementation time whether an explicit `multer` dependency is still needed for the type import).

## 7. Admin review — backend endpoint only, no UI

Checked `design/static_html/review.html` — it's the **applicant-facing** "application
submitted / under review" status page (already implemented as `app/apply/submitted/page.tsx`),
not an admin dashboard. No admin-review page exists anywhere in the design prototype. Per user
decision: build the endpoint (the underlying logic is a bounded, mechanical field mapping — every
`member_profiles` column needed already has a 1:1 equivalent on `membership_applications`, and
`member_services` is just `{member_id, practice_area_id}` pairs from `service_preferences`), skip
building a UI from scratch with no reference — that's `master-tdd.md`'s already-separate, future
"Admin: applications" (US-08) session.

`PATCH /v1/admin/applications/:id` 🛡️ `manageApplications` — body `{status: 'approved' |
'rejected', rejectionReason?: string}` (`rejectionReason` required when `status: 'rejected'`,
checked in the service).

One transaction:
- `approved`: stamp `reviewed_by` (from `@CurrentUser()`), `reviewed_at`; insert `member_profiles`
  (`profile_id`, `bio`, `region`, `country`, `state`, `city`, `years_of_experience`,
  `rate_min_cents`, `rate_max_cents`, `member_tier: selected_tier`, `contact_email`,
  `linkedin_url`, `photo_url: <signed URL minted from photo_path>`, `application_id: <this
  application's id>`, `is_verified: true`, `status: 'active'`); insert one `member_services` row
  per `service_preferences` entry; `update profiles set role = 'member' where id = applicant_id`.
- `rejected`: stamp `reviewed_by`, `reviewed_at`, `rejection_reason` only.
- Reject (`409`) if the application's current status isn't `submitted` or `under_review` — can't
  approve/reject a draft or an already-decided application.

Verified via curl/REST client per root `CLAUDE.md`'s backend-session convention — no frontend
needed.

## 8. Frontend

Keep the existing 5-step grouping (LinkedIn → Identity → Background → Services & Rates → Review) —
already correctly derived from the prototype, no reason to regroup. Redesign the **visual layer**:

- Resume-on-load: `ApplicationWizard` fetches `GET /v1/applications/me` on mount; a `draft` result
  seeds `WizardFormState` and jumps to `current_step`; a `404` starts fresh; any other status
  redirects to `/apply/submitted` (already-submitted applicant shouldn't see the wizard).
- Save-on-advance: each step's "Continue" calls `POST /v1/applications/me` with that step's fields
  (`status` omitted → stays `draft`) before advancing; the final Review step's submit sends
  `status: 'submitted'`. A small "Saved" / "Saving…" indicator near the step actions, tied to that
  call's pending/settled state.
- Real photo upload: replace the local-preview-only file input with an actual call to
  `POST /v1/applications/me/uploads`, showing upload progress/error state, previewing the signed
  URL that comes back in the response.
- Imported-vs-manual-vs-missing affordance: `LinkedInImportStep` calls the new import endpoint,
  merges the (possibly partial) result into `WizardFormState`, and tracks which field names came
  from import in a client-side `Set<string>` (not persisted). Later steps render a small dot/badge
  next to a field only when it's in that set **and** hasn't been edited since import (clear the
  flag on user edit) — subtle, not a wall of color, per the brief.
- Visual pass: new progress rail treatment, refined step-card layout, more deliberate typographic
  hierarchy — all pulling from existing `docs/design-system.md` tokens and `components/ui/*`. No
  new hex values; any genuinely new recurring pattern gets added to `design-system.md`/`ui/` in the
  same change, not left as a one-off.
- Mobile-first, checked at 375px and 1440px per root `CLAUDE.md`'s non-negotiable bar.

## 9. Shared types (`packages/shared-types/membership-application.ts`)

- `ApplicationStatus` gains `'draft'`.
- New `UpdateApplicationRequest` — every `CreateApplicationRequest` field optional, plus
  `status?: 'draft' | 'submitted'`. `CreateApplicationRequest` is removed (nothing depends on the
  old `POST /v1/applications` shape once the endpoint is gone).
- `ApplicationDto` gains `documents: ApplicationDocumentDto[]`; `photoUrl` stays `string | null`
  (now a signed URL, same wire type).
- New `ApplicationDocumentDto { id: string; filename: string; mimeType: string; sizeBytes: number;
  url: string; uploadedAt: string }`.
- New `LinkedInImportRequest { linkedinUrl: string }`, `LinkedInImportResponse` (same shape as
  backend's `LinkedInImportResult`, §5).
- New `AdminApplicationReviewRequest { status: 'approved' | 'rejected'; rejectionReason?: string }`.

## 10. Testing plan

Backend (verified via curl/REST client, no frontend dependency):
- `POST /v1/applications/me` creates a draft on first call; a second call with different fields
  merges rather than overwrites untouched fields; `status: 'submitted'` with an incomplete body
  400s listing what's missing; a complete body transitions to `submitted` and returns computed
  pricing; a second `POST` after submission 409s.
- `POST /v1/applications/me/uploads`: valid JPEG under 5MB for `kind: 'photo'` succeeds and
  `GET /v1/applications/me` reflects a resolvable `photoUrl`; a renamed `.exe` with a fake
  `image/png` content-type header is rejected by the magic-byte check; an oversized file 400s.
- `POST /v1/applications/me/linkedin-import` returns the mock shape with the deliberately-omitted
  fields absent.
- `PATCH /v1/admin/applications/:id`: approve creates `member_profiles` + `member_services` rows
  and flips `profiles.role`; reject without `rejectionReason` 400s; approving a non-`submitted`
  application 409s; a non-`manageApplications` admin gets 403.
- Ownership: a second authenticated client cannot `GET`/`POST` another user's draft (no id in the
  URL, so this is really "cannot see anyone else's `/me` data" — verify the query is always scoped
  by the authenticated user's id, never trusts a client-supplied id).

Frontend (dev server, browser-driven per `apps/frontend/CLAUDE.md`):
- Signup (LinkedIn, member intent) → lands on `/apply` step 1.
- Apply Now CTA → `/apply` step 1.
- Fill step 1–2, refresh the page → resumes on step 2 with step-1 data intact.
- LinkedIn import → partially pre-filled fields show the imported badge; edit one → badge clears
  on that field only; missing fields are empty and required before advancing.
- Manual-only path (skip import) → all fields start empty, same validation.
- Upload a photo → preview updates; upload an invalid file type → inline error, no silent failure.
- Submit → lands on `/apply/submitted`; re-visiting `/apply` while `submitted` redirects away
  rather than showing an empty wizard.
- 375px and 1440px checked for the wizard shell and every step.

## 11. Explicitly out of scope

- Admin review UI (see §7 — deferred to the dedicated future "Admin: applications" session).
- Real n8n integration (mock provider only — swap point documented in §5).
- Payment processing (already deferred platform-wide, unrelated to this feature).
- Fixing the Express-vs-Fastify discrepancy noted in §1 (pre-existing, unrelated to this feature).
