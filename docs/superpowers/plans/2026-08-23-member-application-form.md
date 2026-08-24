# Member Application Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the membership application from a frontend-only, single-shot wizard into a
backend-persisted, resumable, LinkedIn-import-capable, file-upload-capable application with an
admin approve/reject endpoint — built and locally verified, not pushed.

**Architecture:** Extend the existing `membership_applications` table (add `draft` status, relax
NOT NULLs) rather than a new table. One upsert write endpoint (`POST /v1/applications/me`)
replaces the old single-shot create. A `LinkedInImportProvider` DI interface isolates the
not-yet-ready n8n integration behind a mock. File uploads proxy through the backend (not a signed
URL) so magic-byte validation is actually possible. Admin approve/reject is a backend-only
endpoint, no UI.

**Tech Stack:** NestJS (`@nestjs/platform-express` — see spec §1 for why, not Fastify despite the
documented rule), Supabase (Postgres + Storage), Next.js App Router, `class-validator`, `file-type`.

**Spec:** `docs/superpowers/specs/2026-08-23-member-application-form-design.md`

## Global Constraints

- TypeScript strict mode, no `any` (except the one pre-existing `toDto(row: any, ...)` pattern
  already in `applications.service.ts` — keep matching it, don't introduce new ones elsewhere).
- All backend responses go through the existing `ResponseInterceptor` — don't add a second one.
- All DB access via `SupabaseService.db` (service-role client) — RLS is defense-in-depth only.
- Every route gets an explicit auth marker comment (🌐/🔒/🔑/🛡️) per `apps/backend/CLAUDE.md`.
- Frontend: `components/ui/*` + `docs/design-system.md` tokens only, no hardcoded hex/px.
- Mobile-first, checked at 375px and 1440px before any page is called done.
- Do not push to remote. Local commits only, after each task, per user instruction.
- `pnpm typecheck` must pass (root, or `./node_modules/.bin/tsc --noEmit` per-app) before a task
  is considered done.

---

## Task 1: Migration — draft status, relaxed columns, storage bucket

**Correction from the original spec draft:** `supabase/migrations/README.md` documents a
**pre-production, single-schema convention** — until this project ships, every schema change is
folded back into the existing `0001`–`0004` files (dependency order, not feature order), never
appended as a new `0005+` file. This task edits `0002_enums.sql` and `0004_tables.sql` in place.

**Files:**
- Modify: `supabase/migrations/0002_enums.sql`
- Modify: `supabase/migrations/0004_tables.sql`

**Interfaces:**
- Produces: `application_status` enum now includes `'draft'`; `membership_applications` gains
  `current_step smallint`, `photo_path text`, `documents jsonb`; `photo_url` column removed;
  `application-assets` Storage bucket exists with an owner-scoped RLS policy.

- [ ] **Step 1: Edit `0002_enums.sql`**

Change the existing line:
```sql
create type public.application_status as enum ('submitted', 'under_review', 'approved', 'rejected');
```
to:
```sql
create type public.application_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected');
```

- [ ] **Step 2: Edit `0004_tables.sql`'s `membership_applications` table definition in place**

In the `create table public.membership_applications (...)` block: drop `not null` from
`first_name`, `last_name`, `contact_email`, `region`, `country`, `linkedin_url`, `bio`,
`years_of_experience`, `rate_min_cents`, `rate_max_cents`, `billing_period`,
`background_check_consent`; change `status application_status not null default 'submitted'` to
`default 'draft'`; replace `photo_url text` with `photo_path text` (comment: private Storage path,
not a public URL — signed URL minted at read time by `ApplicationsService.toDto()`); add
`current_step smallint not null default 1` and `documents jsonb not null default '[]' check
(jsonb_typeof(documents) = 'array')` (comment: array of `{id, filename, path, mimeType, sizeBytes,
uploadedAt}`, generic/extensible — only the profile photo has upload UI in this iteration).
Update the table-level header comment (currently describing the immutable-snapshot design
principle) to note that `draft` rows are the one deliberate exception, mutated in place until
submit.

Then, in the Storage section of the same file (next to the existing `member-proofs` bucket +
policy):

```sql
-- application-assets bucket, backing POST /v1/applications/me/uploads. Path shape:
-- members/application/{applicantId}/profile-photo.<ext> or document-{n}.<ext> — see
-- docs/superpowers/specs/2026-08-23-member-application-form-design.md §6.
-- storage.foldername(name) = ['members', 'application', '<applicantId>', ...], index 3 (1-indexed)
-- is the applicant id.
insert into storage.buckets (id, name, public) values ('application-assets', 'application-assets', false);

create policy application_assets_owner_all
  on storage.objects for all
  using (bucket_id = 'application-assets' and (storage.foldername(name))[3] = auth.uid()::text)
  with check (bucket_id = 'application-assets' and (storage.foldername(name))[3] = auth.uid()::text);
```

- [ ] **Step 3: Apply against a local/throwaway Postgres and verify it runs cleanly in sequence**

Run the project's documented local-apply flow for `0001` through `0004` in order (check for a
`supabase/config.toml` + `supabase db reset`, or the project's actual documented command — there's
no CLI-agnostic instruction in the README beyond "applied manually... in filename order"). Confirm
no errors and that `\d public.membership_applications` shows the new columns and no `photo_url`.
If no local Postgres/Supabase CLI is available in this environment, state that explicitly rather
than claiming this step passed — do not skip verifying the SQL is at least syntactically
self-consistent (matching parens, valid column references) by careful reading.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_enums.sql supabase/migrations/0004_tables.sql
git commit -m "feat(db): add draft status and application-assets storage bucket"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared-types/membership-application.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ApplicationStatus` (now includes `'draft'`), `UpdateApplicationRequest`,
  `ApplicationDocumentDto`, `ApplicationDto` (extended), `LinkedInImportRequest`,
  `LinkedInImportResponse`, `AdminApplicationReviewRequest` — every backend/frontend task below
  imports from here with `import type`.

- [ ] **Step 1: Update the file**

```typescript
export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

// ... (ApplicationRegion, FirmSize, MembershipTier, BillingPeriod, PaymentStatus,
// WorkExperienceInput, EducationInput, ServicePreferenceInput, ServicePreference unchanged)

/** POST /v1/applications/me request body — every field optional (draft-safe). */
export interface UpdateApplicationRequest {
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  phoneCountryCode?: string;
  phone?: string;
  region?: ApplicationRegion;
  country?: string;
  state?: string;
  city?: string;
  linkedinUrl?: string;
  bio?: string;
  yearsOfExperience?: number;
  workExperiences?: WorkExperienceInput[];
  educations?: EducationInput[];
  servicePreferences?: ServicePreferenceInput[];
  rateMinCents?: number;
  rateMaxCents?: number;
  billingPeriod?: BillingPeriod;
  couponCode?: string;
  linkedinImportConsent?: boolean;
  termsVersionAgreed?: string;
  privacyVersionAgreed?: string;
  backgroundCheckConsent?: boolean;
  currentStep?: number;
  /** Omit or 'draft' to save progress. 'submitted' triggers full validation + transition. */
  status?: 'draft' | 'submitted';
}

export interface ApplicationDocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Signed URL, minted at read time — not stable, don't cache long-term. */
  url: string;
  uploadedAt: string;
}

/** Response shape for POST /v1/applications/me (200) and GET /v1/applications/me (200). */
export interface ApplicationDto {
  id: string;
  status: ApplicationStatus;
  currentStep: number;
  photoUrl: string | null;
  documents: ApplicationDocumentDto[];
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  phoneCountryCode: string | null;
  phone: string | null;
  region: ApplicationRegion | null;
  country: string | null;
  state: string | null;
  city: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  workExperiences: WorkExperienceInput[];
  educations: EducationInput[];
  servicePreferences: ServicePreference[];
  rateMinCents: number | null;
  rateMaxCents: number | null;
  selectedTier: MembershipTier | null;
  billingPeriod: BillingPeriod | null;
  listPriceCents: number | null;
  couponCode: string | null;
  discountAmountCents: number | null;
  amountDueCents: number | null;
  paymentStatus: PaymentStatus | null;
  createdAt: string;
}

export interface LinkedInImportRequest {
  linkedinUrl: string;
}

export interface LinkedInImportResponse {
  firstName?: string;
  lastName?: string;
  bio?: string;
  yearsOfExperience?: number;
  workExperiences?: WorkExperienceInput[];
  educations?: EducationInput[];
  country?: string;
  city?: string;
}

export interface AdminApplicationReviewRequest {
  status: 'approved' | 'rejected';
  /** Required when status is 'rejected'. */
  rejectionReason?: string;
}
```

Remove `CreateApplicationRequest` entirely — nothing depends on the old `POST /v1/applications`
shape once Task 4 replaces it.

- [ ] **Step 2: Typecheck the package**

Run: `pnpm --filter @expertly/shared-types typecheck` (or the package's actual script name — check
`packages/shared-types/package.json`).
Expected: passes (this file has no logic, just types — the real check is that downstream imports
compile, done in later tasks).

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/membership-application.ts
git commit -m "feat(shared-types): add draft/upload/linkedin-import application types"
```

---

## Task 3: `POST /v1/applications/me` — save-or-submit, replacing the old create endpoint

**Files:**
- Modify: `apps/backend/src/applications/applications.controller.ts`
- Modify: `apps/backend/src/applications/applications.service.ts`
- Create: `apps/backend/src/applications/dto/update-application.dto.ts`
- Delete: `apps/backend/src/applications/dto/create-application.dto.ts` (superseded)

**Interfaces:**
- Consumes: `WorkExperienceDto`, `EducationDto`, `ServicePreferenceDto` (existing, unchanged),
  `computeTier`/`MEMBERSHIP_PRICE_CENTS` (existing, unchanged), `applyCoupon` (existing,
  unchanged).
- Produces: `ApplicationsService.saveOrSubmit(user, dto): Promise<ApplicationDto>` — used by the
  controller in this task and nowhere else yet.

- [ ] **Step 1: Write `UpdateApplicationDto`**

```typescript
// apps/backend/src/applications/dto/update-application.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Max,
  MaxLength, Min, ValidateNested,
} from 'class-validator';
import type { ApplicationRegion, BillingPeriod } from '@shared/membership-application';
import { WorkExperienceDto } from './work-experience.dto';
import { EducationDto } from './education.dto';
import { ServicePreferenceDto } from './service-preference.dto';

const REGIONS: ApplicationRegion[] = [
  'asia_pacific', 'europe', 'latin_america', 'middle_east', 'north_america', 'south_asia', 'africa',
];
const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'annual'];

// Every field optional — a draft can be arbitrarily incomplete. Completeness for `status:
// 'submitted'` is checked in ApplicationsService.saveOrSubmit, not here (same "cross-field rules
// live in the service" convention CreateApplicationDto used to follow).
export class UpdateApplicationDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() phoneCountryCode?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsIn(REGIONS) region?: ApplicationRegion;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsUrl() linkedinUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) yearsOfExperience?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true })
  @Type(() => WorkExperienceDto) workExperiences?: WorkExperienceDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true })
  @Type(() => EducationDto) educations?: EducationDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true })
  @Type(() => ServicePreferenceDto) servicePreferences?: ServicePreferenceDto[];

  @IsOptional() @IsInt() @Min(0) rateMinCents?: number;
  @IsOptional() @IsInt() rateMaxCents?: number;
  @IsOptional() @IsIn(BILLING_PERIODS) billingPeriod?: BillingPeriod;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsBoolean() linkedinImportConsent?: boolean;
  @IsOptional() @IsString() termsVersionAgreed?: string;
  @IsOptional() @IsString() privacyVersionAgreed?: string;
  @IsOptional() @IsBoolean() backgroundCheckConsent?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(5) currentStep?: number;
  @IsOptional() @IsIn(['draft', 'submitted']) status?: 'draft' | 'submitted';
}
```

- [ ] **Step 2: Delete the old DTO and replace `create()` with `saveOrSubmit()` in the service**

Delete `apps/backend/src/applications/dto/create-application.dto.ts`.

In `applications.service.ts`, replace the `create()` method with:

```typescript
async saveOrSubmit(user: AuthenticatedUser, dto: UpdateApplicationDto): Promise<ApplicationDto> {
  if (user.role !== 'client') {
    throw new ForbiddenException('Only client accounts can manage a membership application.');
  }
  if (
    dto.rateMinCents !== undefined &&
    dto.rateMaxCents !== undefined &&
    dto.rateMaxCents <= dto.rateMinCents
  ) {
    throw new BadRequestException('rateMaxCents must be greater than rateMinCents.');
  }

  const { data: existing, error: existingError } = await this.supabase.db
    .from('membership_applications')
    .select('*')
    .eq('applicant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new InternalServerErrorException('Failed to load application.');
  if (existing && existing.status !== 'draft') {
    throw new ConflictException('You already have an application in progress or decided.');
  }

  // Practice-area validation only when servicePreferences is actually part of this write —
  // a draft PATCH that doesn't touch step 4 shouldn't require it.
  let practiceAreaById = new Map<string, string>();
  const effectiveServicePreferences = dto.servicePreferences ?? existing?.service_preferences ?? [];
  if (effectiveServicePreferences.length > 0) {
    const practiceAreaIds = effectiveServicePreferences.map((p: { practiceAreaId: string }) => p.practiceAreaId);
    const { data: practiceAreas, error: practiceAreasError } = await this.supabase.db
      .from('practice_areas')
      .select('id, name')
      .eq('is_active', true)
      .in('id', practiceAreaIds);
    if (practiceAreasError) throw new InternalServerErrorException('Failed to validate service preferences.');
    practiceAreaById = new Map((practiceAreas ?? []).map((p) => [p.id, p.name as string]));
    const invalidIds = practiceAreaIds.filter((id: string) => !practiceAreaById.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid or inactive practice area id(s): ${invalidIds.join(', ')}`);
    }
  }

  const merged = this.mergeRow(existing, dto);
  const wantsSubmit = dto.status === 'submitted';

  if (wantsSubmit) {
    this.assertComplete(merged);
    const selectedTier = computeTier(merged.years_of_experience);
    const listPriceCents = MEMBERSHIP_PRICE_CENTS[merged.billing_period as BillingPeriod];
    const couponResult = applyCoupon(merged.coupon_code, listPriceCents);
    if (!couponResult.valid) throw new BadRequestException('Invalid or expired coupon code.');
    const discountAmountCents = couponResult.discountAmountCents;
    const amountDueCents = Math.max(0, listPriceCents - discountAmountCents);
    merged.status = 'submitted';
    merged.selected_tier = selectedTier;
    merged.list_price_cents = listPriceCents;
    merged.discount_amount_cents = discountAmountCents;
    merged.amount_due_cents = amountDueCents;
    merged.payment_status = amountDueCents === 0 ? 'waived' : 'pending';
  }

  const { data: saved, error: saveError } = existing
    ? await this.supabase.db.from('membership_applications').update(merged).eq('id', existing.id).select().single()
    : await this.supabase.db.from('membership_applications').insert({ ...merged, applicant_id: user.id }).select().single();
  if (saveError || !saved) throw new InternalServerErrorException('Failed to save application.');

  if (effectiveServicePreferences.length > 0 && practiceAreaById.size === 0) {
    // servicePreferences unchanged this call — resolve names for the response from the row itself.
    const ids = effectiveServicePreferences.map((p: { practiceAreaId: string }) => p.practiceAreaId);
    const { data: pa } = await this.supabase.db.from('practice_areas').select('id, name').in('id', ids);
    for (const p of pa ?? []) practiceAreaById.set(p.id, p.name);
  }

  return this.toDto(saved, practiceAreaById);
}

private mergeRow(existing: Record<string, unknown> | null, dto: UpdateApplicationDto) {
  const row: Record<string, unknown> = existing ? { ...existing } : { status: 'draft' };
  const set = (col: string, val: unknown) => { if (val !== undefined) row[col] = val; };
  set('first_name', dto.firstName);
  set('last_name', dto.lastName);
  set('contact_email', dto.contactEmail);
  set('phone_country_code', dto.phoneCountryCode);
  set('phone', dto.phone);
  set('region', dto.region);
  set('country', dto.country);
  set('state', dto.state);
  set('city', dto.city);
  set('linkedin_url', dto.linkedinUrl);
  set('bio', dto.bio);
  set('years_of_experience', dto.yearsOfExperience);
  set('work_experiences', dto.workExperiences);
  set('educations', dto.educations);
  set('service_preferences', dto.servicePreferences);
  set('rate_min_cents', dto.rateMinCents);
  set('rate_max_cents', dto.rateMaxCents);
  set('billing_period', dto.billingPeriod);
  set('coupon_code', dto.couponCode);
  set('linkedin_import_consent', dto.linkedinImportConsent);
  set('terms_version_agreed', dto.termsVersionAgreed);
  set('privacy_version_agreed', dto.privacyVersionAgreed);
  set('background_check_consent', dto.backgroundCheckConsent);
  set('current_step', dto.currentStep);
  delete row.id; delete row.created_at; delete row.updated_at; delete row.applicant_id;
  return row;
}

private assertComplete(row: Record<string, unknown>) {
  const required: [string, unknown][] = [
    ['firstName', row.first_name], ['lastName', row.last_name], ['contactEmail', row.contact_email],
    ['region', row.region], ['country', row.country], ['linkedinUrl', row.linkedin_url],
    ['bio', row.bio], ['yearsOfExperience', row.years_of_experience],
    ['rateMinCents', row.rate_min_cents], ['rateMaxCents', row.rate_max_cents],
    ['billingPeriod', row.billing_period], ['backgroundCheckConsent', row.background_check_consent],
  ];
  const missing = required.filter(([, v]) => v === null || v === undefined).map(([k]) => k);
  const workExperiences = (row.work_experiences ?? []) as unknown[];
  const educations = (row.educations ?? []) as unknown[];
  const servicePreferences = (row.service_preferences ?? []) as unknown[];
  if (workExperiences.length < 1) missing.push('workExperiences');
  if (educations.length < 1) missing.push('educations');
  if (servicePreferences.length < 1) missing.push('servicePreferences');
  if ((row.rate_max_cents as number) <= (row.rate_min_cents as number)) missing.push('rateMaxCents > rateMinCents');
  if (row.background_check_consent !== true) missing.push('backgroundCheckConsent must be true');
  if (missing.length > 0) {
    throw new BadRequestException(`Cannot submit — missing or invalid: ${missing.join(', ')}`);
  }
}
```

Update `toDto()` to add `currentStep: row.current_step`, `documents: this.resolveDocuments(row.documents)`,
`photoUrl: row.photo_path ? this.signedUrl(row.photo_path) : null` (implement `signedUrl` using
`this.supabase.db.storage.from('application-assets').createSignedUrl(path, 3600)` — this becomes
`async`, so `toDto` and every caller of it become `async` too; update call sites accordingly), and
change every previously-required response field's TS type to allow `null` (matches Task 2's
`ApplicationDto`).

Update the controller:

```typescript
@Post('me')
saveOrSubmit(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateApplicationDto): Promise<ApplicationDto> {
  return this.service.saveOrSubmit(user, dto);
}
```

Remove the old `@Post()` handler and `create()`/`CreateApplicationDto` references.

- [ ] **Step 3: Manual verification via curl**

Run (with a real client-role bearer token):
```bash
curl -s -X POST localhost:4000/v1/applications/me -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"firstName":"Ada"}'
```
Expected: `200`, response `status: "draft"`, `firstName: "Ada"`, all other fields `null`/empty.

Run again with `{"lastName":"Lovelace"}`:
Expected: response has **both** `firstName: "Ada"` and `lastName: "Lovelace"` (merge, not
overwrite).

Run with `{"status":"submitted"}` (nothing else changed):
Expected: `400`, body lists every still-missing required field.

- [ ] **Step 4: Run backend typecheck**

Run: `pnpm --filter ./apps/backend typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/applications
git commit -m "feat(applications): replace one-shot create with draft save-or-submit"
```

---

## Task 4: LinkedIn import boundary

**Files:**
- Create: `apps/backend/src/applications/linkedin-import/linkedin-import.provider.ts`
- Create: `apps/backend/src/applications/linkedin-import/mock-linkedin-import.provider.ts`
- Modify: `apps/backend/src/applications/applications.module.ts`
- Modify: `apps/backend/src/applications/applications.controller.ts`
- Modify: `apps/backend/src/applications/applications.service.ts`

**Interfaces:**
- Produces: `LinkedInImportProvider` (abstract DI token), consumed only by
  `ApplicationsService.importFromLinkedIn`.

- [ ] **Step 1: Write the provider interface and mock**

```typescript
// linkedin-import.provider.ts
import type { LinkedInImportResponse } from '@shared/membership-application';

export abstract class LinkedInImportProvider {
  abstract importProfile(linkedinUrl: string): Promise<LinkedInImportResponse>;
}
```

```typescript
// mock-linkedin-import.provider.ts
import { Injectable } from '@nestjs/common';
import type { LinkedInImportResponse } from '@shared/membership-application';
import { LinkedInImportProvider } from './linkedin-import.provider';

// Deterministic, not random — same URL always returns the same shape, so frontend/manual testing
// is reproducible. Deliberately omits country/city/yearsOfExperience so the "user fills what
// couldn't be imported" UX is exercised for real. Swap point for the real n8n-backed provider:
// implement LinkedInImportProvider and rebind the token in applications.module.ts — no other file
// changes.
@Injectable()
export class MockLinkedInImportProvider implements LinkedInImportProvider {
  async importProfile(linkedinUrl: string): Promise<LinkedInImportResponse> {
    const slug = linkedinUrl.replace(/\/+$/, '').split('/').pop() ?? 'member';
    const name = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const [firstName, ...rest] = name.split(' ');
    return {
      firstName: firstName || undefined,
      lastName: rest.join(' ') || undefined,
      bio: 'Experienced professional advising clients across a range of engagements.',
      workExperiences: [
        {
          title: 'Senior Consultant', company: 'Independent Practice', startYear: 2019,
          isCurrent: true,
        },
      ],
      educations: [{ institution: 'Imported from LinkedIn', degree: 'Not specified' }],
    };
  }
}
```

- [ ] **Step 2: Wire into the module and add the endpoint**

In `applications.module.ts`, add to `providers`: `{ provide: LinkedInImportProvider, useClass: MockLinkedInImportProvider }`.

In `applications.service.ts`, inject `LinkedInImportProvider` in the constructor and add:

```typescript
async importFromLinkedIn(linkedinUrl: string) {
  return this.linkedInImportProvider.importProfile(linkedinUrl);
}
```

In `applications.controller.ts`:

```typescript
// 🔒 Auth only — pure fetch-and-normalize, doesn't touch the draft (see spec §5).
@Post('me/linkedin-import')
importLinkedIn(@Body() dto: LinkedInImportRequestDto): Promise<LinkedInImportResponse> {
  return this.service.importFromLinkedIn(dto.linkedinUrl);
}
```

Add `apps/backend/src/applications/dto/linkedin-import-request.dto.ts`:

```typescript
import { IsUrl } from 'class-validator';

export class LinkedInImportRequestDto {
  @IsUrl() linkedinUrl!: string;
}
```

- [ ] **Step 3: Manual verification**

Run:
```bash
curl -s -X POST localhost:4000/v1/applications/me/linkedin-import -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"linkedinUrl":"https://linkedin.com/in/jane-doe"}'
```
Expected: `200`, `firstName: "Jane"`, `lastName: "Doe"`, `bio`/`workExperiences`/`educations`
present, no `country`/`city`/`yearsOfExperience` keys.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter ./apps/backend typecheck`

```bash
git add apps/backend/src/applications
git commit -m "feat(applications): add LinkedIn import boundary with mock provider"
```

---

## Task 5: File upload endpoint

**Files:**
- Modify: `apps/backend/package.json` (add `file-type`; add `@types/multer` if not already
  transitively typed — check after `pnpm install`)
- Create: `apps/backend/src/applications/dto/upload-application-file.dto.ts`
- Modify: `apps/backend/src/applications/applications.controller.ts`
- Modify: `apps/backend/src/applications/applications.service.ts`

**Interfaces:**
- Produces: `ApplicationsService.uploadFile(user, kind, file): Promise<ApplicationDto>`.

- [ ] **Step 1: Install `file-type@16` and `@types/multer`**

**Correction found during implementation:** `file-type` v17+ is pure ESM with an exports-map-only
type layout — this backend's CommonJS `moduleResolution` can't resolve its types at all, even
through a dynamic `import()` (confirmed: `TS2307`). Pinned to `file-type@16` instead, the last
CJS-native major, whose API is `fromBuffer` (not `fileTypeFromBuffer`, which is the v17+ name).

Run: `pnpm --filter ./apps/backend add file-type@16`
Run: `pnpm --filter ./apps/backend add -D @types/multer` — required: `Express.Multer.File` doesn't
resolve without it (confirmed: `TS2694`).

- [ ] **Step 2: DTO for the non-file form field**

```typescript
// upload-application-file.dto.ts
import { IsIn } from 'class-validator';

export class UploadApplicationFileDto {
  @IsIn(['photo', 'document']) kind!: 'photo' | 'document';
}
```

- [ ] **Step 3: Service method**

```typescript
import { fromBuffer as sniffFileType } from 'file-type';

const ALLOWED_MIME: Record<'photo' | 'document', string[]> = {
  photo: ['image/jpeg', 'image/png'],
  document: ['image/jpeg', 'image/png', 'application/pdf'],
};
const MAX_BYTES: Record<'photo' | 'document', number> = {
  photo: 5 * 1024 * 1024,
  document: 15 * 1024 * 1024,
};

async uploadFile(
  user: AuthenticatedUser,
  kind: 'photo' | 'document',
  file: Express.Multer.File,
): Promise<ApplicationDto> {
  if (file.size > MAX_BYTES[kind]) {
    throw new BadRequestException(`File too large — max ${MAX_BYTES[kind] / 1024 / 1024}MB for ${kind}.`);
  }
  const sniffed = await sniffFileType(file.buffer);
  if (!sniffed || !ALLOWED_MIME[kind].includes(sniffed.mime)) {
    throw new BadRequestException(`Unsupported file type for ${kind}.`);
  }

  const { data: existing, error: existingError } = await this.supabase.db
    .from('membership_applications')
    .select('*')
    .eq('applicant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError || !existing || existing.status !== 'draft') {
    throw new BadRequestException('No draft application to attach this file to.');
  }

  const path =
    kind === 'photo'
      ? `members/application/${user.id}/profile-photo.${sniffed.ext}`
      : `members/application/${user.id}/document-${(existing.documents as unknown[]).length + 1}.${sniffed.ext}`;

  const { error: uploadError } = await this.supabase.db.storage
    .from('application-assets')
    .upload(path, file.buffer, { contentType: sniffed.mime, upsert: true });
  if (uploadError) throw new InternalServerErrorException('Failed to store file.');

  const patch: Record<string, unknown> =
    kind === 'photo'
      ? { photo_path: path }
      : {
          documents: [
            ...(existing.documents as unknown[]),
            {
              id: randomUUID(), filename: file.originalname, path, mimeType: sniffed.mime,
              sizeBytes: file.size, uploadedAt: new Date().toISOString(),
            },
          ],
        };

  const { data: saved, error: saveError } = await this.supabase.db
    .from('membership_applications').update(patch).eq('id', existing.id).select().single();
  if (saveError || !saved) throw new InternalServerErrorException('Failed to save upload reference.');

  return this.toDto(saved, new Map());
}
```

(`randomUUID` from `node:crypto`, import at top of file.)

- [ ] **Step 4: Controller route**

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';

// 🔒 Auth — owner-scoped via user.id inside the service, kind validated against an allow-list.
@Post('me/uploads')
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
uploadFile(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: UploadApplicationFileDto,
  @UploadedFile() file: Express.Multer.File,
): Promise<ApplicationDto> {
  if (!file) throw new BadRequestException('No file provided.');
  return this.service.uploadFile(user, dto.kind, file);
}
```

- [ ] **Step 5: Manual verification**

Run (with a real JPEG under 5MB):
```bash
curl -s -X POST localhost:4000/v1/applications/me/uploads -H "Authorization: Bearer $TOKEN" \
  -F "kind=photo" -F "file=@/path/to/photo.jpg"
```
Expected: `200`, response `photoUrl` is a working signed URL (paste into a browser, image loads).

Run with a `.txt` file renamed to `.jpg` and `-F "kind=photo"`:
Expected: `400` — magic-byte sniff catches the mismatch even though the filename looks right.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter ./apps/backend typecheck`

```bash
git add apps/backend/src/applications apps/backend/package.json
git commit -m "feat(applications): add magic-byte-validated file upload endpoint"
```

---

## Task 6: Admin approve/reject endpoint

**Files:**
- Create: `apps/backend/src/applications/admin-applications.controller.ts`
- Modify: `apps/backend/src/applications/applications.service.ts` (add `reviewApplication`)
- Modify: `apps/backend/src/applications/applications.module.ts` (register the new controller)
- Create: `apps/backend/src/applications/dto/review-application.dto.ts`

**Interfaces:**
- Consumes: `AdminPermissionGuard`, `RequirePermission` (existing, from `auth/`).
- Produces: `PATCH /v1/admin/applications/:id`.

- [ ] **Step 1: DTO**

```typescript
// review-application.dto.ts
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected']) status!: 'approved' | 'rejected';

  @ValidateIf((o) => o.status === 'rejected')
  @IsString()
  rejectionReason?: string;
}
```

- [ ] **Step 2: Service method**

```typescript
async reviewApplication(applicationId: string, reviewer: AuthenticatedUser, dto: ReviewApplicationDto) {
  const { data: application, error } = await this.supabase.db
    .from('membership_applications').select('*').eq('id', applicationId).maybeSingle();
  if (error) throw new InternalServerErrorException('Failed to load application.');
  if (!application) throw new NotFoundException('Application not found.');
  if (!['submitted', 'under_review'].includes(application.status)) {
    throw new ConflictException('Only a submitted or under-review application can be reviewed.');
  }
  if (dto.status === 'rejected' && !dto.rejectionReason) {
    throw new BadRequestException('rejectionReason is required when rejecting.');
  }

  const reviewedAt = new Date().toISOString();

  if (dto.status === 'rejected') {
    const { error: updateError } = await this.supabase.db
      .from('membership_applications')
      .update({ status: 'rejected', reviewed_by: reviewer.id, reviewed_at: reviewedAt, rejection_reason: dto.rejectionReason })
      .eq('id', applicationId);
    if (updateError) throw new InternalServerErrorException('Failed to reject application.');
    return { status: 'rejected' as const };
  }

  const photoUrl = application.photo_path
    ? (await this.supabase.db.storage.from('application-assets').createSignedUrl(application.photo_path, 60 * 60 * 24 * 365)).data?.signedUrl ?? null
    : null;

  const { error: profileError } = await this.supabase.db.from('member_profiles').insert({
    profile_id: application.applicant_id,
    bio: application.bio,
    region: application.region,
    country: application.country,
    state: application.state,
    city: application.city,
    years_of_experience: application.years_of_experience,
    rate_min_cents: application.rate_min_cents,
    rate_max_cents: application.rate_max_cents,
    member_tier: application.selected_tier,
    contact_email: application.contact_email,
    linkedin_url: application.linkedin_url,
    photo_url: photoUrl,
    application_id: application.id,
    is_verified: true,
    status: 'active',
  });
  if (profileError) throw new InternalServerErrorException('Failed to provision member profile.');

  const servicePreferences = (application.service_preferences ?? []) as { practiceAreaId: string }[];
  if (servicePreferences.length > 0) {
    const { error: servicesError } = await this.supabase.db.from('member_services').insert(
      servicePreferences.map((p) => ({ member_id: application.applicant_id, practice_area_id: p.practiceAreaId })),
    );
    if (servicesError) throw new InternalServerErrorException('Failed to provision member services.');
  }

  const { error: roleError } = await this.supabase.db
    .from('profiles').update({ role: 'member' }).eq('id', application.applicant_id);
  if (roleError) throw new InternalServerErrorException('Failed to promote applicant to member.');

  const { error: appUpdateError } = await this.supabase.db
    .from('membership_applications')
    .update({ status: 'approved', reviewed_by: reviewer.id, reviewed_at: reviewedAt })
    .eq('id', applicationId);
  if (appUpdateError) throw new InternalServerErrorException('Failed to finalize application status.');

  return { status: 'approved' as const };
}
```

(Note: this isn't a real DB transaction — Supabase-js has no multi-statement transaction API from
the client. Sequenced with the row-provisioning writes before the role flip and the application
status update last, so a mid-sequence failure leaves the application still `submitted`/reviewable
rather than silently `approved` with no member — acceptable given the constraints, but flag to the
user in the task summary rather than silently treating it as a true transaction.)

- [ ] **Step 3: Controller**

```typescript
// admin-applications.controller.ts
import { Body, Controller, Param, Patch } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ApplicationsService } from './applications.service';
import { ReviewApplicationDto } from './dto/review-application.dto';

// 🛡️ manageApplications only, enforced by AdminPermissionGuard (global, per auth/ setup).
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @RequirePermission('manageApplications')
  @Patch(':id')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.service.reviewApplication(id, user, dto);
  }
}
```

Check the exact decorator import names/paths against `apps/backend/src/members/admin-members.controller.ts` — mirror that file's actual `RequirePermission`/guard wiring exactly rather than
guessing at names.

- [ ] **Step 4: Manual verification**

Approve flow: submit a complete application as a client, then as an admin token with
`manageApplications`:
```bash
curl -s -X PATCH localhost:4000/v1/admin/applications/$APP_ID -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"approved"}'
```
Expected: `200`; a follow-up `GET /v1/members/:applicantProfileId` (or a DB check) shows a new
`member_profiles` row and `profiles.role = 'member'` for that applicant.

Reject flow without `rejectionReason`: expect `400`.
Non-admin token: expect `403`.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter ./apps/backend typecheck`

```bash
git add apps/backend/src/applications
git commit -m "feat(applications): add admin approve/reject endpoint"
```

---

## Task 7: Update `docs/rest-api.md` and `docs/database-erd.md`

**Files:**
- Modify: `docs/rest-api.md`
- Modify: `docs/database-erd.md`

- [ ] **Step 1: Replace the "Membership applications" section of `docs/rest-api.md`**

Remove the old `POST /v1/applications` / `GET /v1/applications/me` description and the "not built
yet" deferred-admin-review note. Document the five real endpoints from spec §4 (request/response
shapes, auth markers, error codes) in the same style as the existing Articles/Members sections.

- [ ] **Step 2: Update `docs/database-erd.md`'s `membership_applications` section**

Reflect: `draft` status, nullable columns, `current_step`, `photo_path` (replacing `photo_url`),
`documents`, and the new `application-assets` bucket (mirroring how `member-proofs` is documented
there today).

- [ ] **Step 3: Commit**

```bash
git add docs/rest-api.md docs/database-erd.md
git commit -m "docs: update rest-api and database-erd for application draft/upload/review"
```

---

## Task 8: Frontend — `lib/api/applications.ts` and wizard resume/save wiring

**Files:**
- Modify: `apps/frontend/lib/api/applications.ts`
- Modify: `apps/frontend/components/apply/ApplicationWizard.tsx`
- Modify: `apps/frontend/components/apply/types.ts`

**Interfaces:**
- Consumes: `UpdateApplicationRequest`, `ApplicationDto`, `LinkedInImportRequest`,
  `LinkedInImportResponse` from `@shared/membership-application` (Task 2).
- Produces: `saveApplication(patch: UpdateApplicationRequest): Promise<ApplicationDto>`,
  `getMyApplication(): Promise<ApplicationDto | null>`, `importLinkedIn(url: string):
  Promise<LinkedInImportResponse>`, `uploadApplicationFile(kind, file): Promise<ApplicationDto>` —
  used by every step component in Tasks 9-10.

- [ ] **Step 1: Rewrite `lib/api/applications.ts`**

```typescript
import { apiClient } from '@/lib/api/client';
import type {
  ApplicationDto, LinkedInImportRequest, LinkedInImportResponse, UpdateApplicationRequest,
} from '@shared/membership-application';

export async function getMyApplication(): Promise<ApplicationDto | null> {
  try {
    return await apiClient.get<ApplicationDto>('/applications/me');
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export function saveApplication(patch: UpdateApplicationRequest): Promise<ApplicationDto> {
  return apiClient.post<ApplicationDto>('/applications/me', patch);
}

export function importLinkedIn(body: LinkedInImportRequest): Promise<LinkedInImportResponse> {
  return apiClient.post<LinkedInImportResponse>('/applications/me/linkedin-import', body);
}

export async function uploadApplicationFile(
  kind: 'photo' | 'document',
  file: File,
): Promise<ApplicationDto> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  return apiClient.postForm<ApplicationDto>('/applications/me/uploads', form);
}
```

Check `apiClient`'s actual method names/signatures in `lib/api/client.ts` first (this plan assumes
`get`/`post` exist per `getPracticeAreas`'s usage pattern already in the codebase; add a
`postForm` method there if it doesn't already support `FormData` bodies — don't set a
`Content-Type` header manually for it, let the browser set the multipart boundary).

- [ ] **Step 2: Resume-on-load in `ApplicationWizard`**

```typescript
useEffect(() => {
  getMyApplication().then((app) => {
    if (!app) return;
    if (app.status !== 'draft') {
      router.replace('/apply/submitted');
      return;
    }
    setForm((prev) => ({ ...prev, ...fromDto(app) }));
    setStep(app.currentStep || 1);
  });
}, []);
```

Add a `fromDto(app: ApplicationDto): Partial<WizardFormState>` helper in `types.ts` that maps the
DTO's (possibly-null) fields back into `WizardFormState`'s string-based controlled-input shape
(inverse of `ReviewSubmitStep`'s existing `submitApplication(...)` call construction) — e.g.
`rateMinDollars: app.rateMinCents != null ? String(app.rateMinCents / 100) : ''`.

Add `saveStep(patch: UpdateApplicationRequest)` in `ApplicationWizard`, called by each step's
`onNext` before advancing:

```typescript
async function saveStep(patch: Partial<import('@shared/membership-application').UpdateApplicationRequest>) {
  await saveApplication({ ...patch, currentStep: step });
}
```

Each step component (`IdentityStep`, `BackgroundStep`, `ServicesRatesStep`) changes its `onNext`
prop usage from a plain `() => goTo(n)` to an async handler that calls `saveStep({...that step's
fields in request shape...})` then `goTo(n)`, showing a brief "Saving…" state on the Continue
button (disable it, swap label) while the request is in flight, and an inline error if it fails
(don't advance on failure).

- [ ] **Step 3: Browser verification**

Run the dev server (`pnpm dev` or `pnpm --filter ./apps/frontend dev`). Sign in as a client, go to
`/apply`, fill step 1-2, click Continue to step 3, refresh the page. Expected: lands back on step
3 (not step 1) with steps 1-2's data intact — check via the browser, not just reading code.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter ./apps/frontend typecheck`

```bash
git add apps/frontend/lib/api/applications.ts apps/frontend/components/apply
git commit -m "feat(apply): wire wizard to backend draft persistence with resume-on-load"
```

---

## Task 9: Frontend — real photo upload + LinkedIn import wiring

**Files:**
- Modify: `apps/frontend/components/apply/steps/IdentityStep.tsx` (photo upload)
- Modify: `apps/frontend/components/apply/steps/LinkedInImportStep.tsx`
- Modify: `apps/frontend/components/apply/types.ts` (add `importedFields: Set<string>` to
  `WizardFormState`, and a `photoUrl` field to hold the signed URL from the upload response)

- [ ] **Step 1: Photo upload in `IdentityStep`**

Confirmed: `IdentityStep.tsx` currently has no photo field at all (the design prototype's
`apply.html` has one; this component never implemented it). Add one — a labeled upload control
(matching the visual language of the other `Input`/`Select` fields in this step, styled per Task
10's pass) with `<input type="file" accept="image/jpeg,image/png" className="sr-only" />` behind
it, placed above the name fields (matches `apply.html`'s layout — photo first). On change: call
`uploadApplicationFile('photo', file)`, show a spinner on the control while pending, render the
returned `photoUrl` as a live avatar preview on success, and show an inline error (not a silent
failure) if the upload is rejected — surface the backend's exact message (wrong type / too large).
Add `photoUrl?: string` to `WizardFormState` (Task 8's `types.ts` already touched) to hold it.

- [ ] **Step 2: LinkedIn import merge + provenance tracking in `LinkedInImportStep`**

On "Continue" (only when a LinkedIn URL was entered and consent given — unchanged gate), call
`importLinkedIn({linkedinUrl: form.linkedinUrl})`, merge the non-undefined fields of the result
into `form` via `update(...)`, and record which field names were actually set into a new
`form.importedFields: Set<string>`. Any `update()` call elsewhere in the wizard that changes a
field already in `importedFields` removes it from that set (edited fields stop being "imported").

- [ ] **Step 3: Browser verification**

Enter a LinkedIn URL, continue — confirm Identity/Background steps show the mock name/bio/work
history pre-filled, with `country`/`city`/`yearsOfExperience` empty and required. Edit the
pre-filled bio — confirm its imported-indicator (added in Task 11's visual pass) would clear (can
verify the underlying `importedFields` state via React DevTools if the visual badge isn't wired
yet at this point in sequencing).

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter ./apps/frontend typecheck`

```bash
git add apps/frontend/components/apply
git commit -m "feat(apply): wire real photo upload and LinkedIn import merge"
```

---

## Task 10: Frontend — visual redesign pass

**Files:**
- Modify: `apps/frontend/components/apply/WizardSidebar.tsx`
- Modify: `apps/frontend/components/apply/WizardProgress.tsx`
- Modify: `apps/frontend/components/apply/StepActions.tsx`
- Modify: all files under `apps/frontend/components/apply/steps/`
- Possibly modify: `docs/design-system.md`, `components/ui/*` (only if a genuinely new recurring
  pattern emerges — e.g. an "imported field" badge component reused across 3+ steps)

- [ ] **Step 1: Design the progress rail and step-card treatment**

Within existing tokens (`docs/design-system.md`) only. Concretely: refine `WizardProgress` to show
step labels + a filled/active/upcoming state per step (not just a bare counter, if that's what it
is today — read the current file first), tighten `WizardSidebar`'s spacing/typography, add a
"Saved just now" / "Saving…" micro-state near `StepActions` tied to Task 8's save calls, and add
the imported-field badge (small dot + tooltip, using an existing `Badge` component from
`components/ui/` if it fits, or a minimal new pattern added to `design-system.md` if not).

- [ ] **Step 2: Browser verification at both breakpoints**

Run the dev server, open `/apply` in a browser at 375px width — check every step's layout doesn't
overflow/clip and the sidebar restructures sensibly (per root `CLAUDE.md`'s "hide/restructure
desktop-only elements below a breakpoint" guidance). Repeat at 1440px.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter ./apps/frontend typecheck`

```bash
git add apps/frontend/components/apply docs/design-system.md
git commit -m "feat(apply): redesign wizard visual layer within design-system tokens"
```

---

## Task 11: End-to-end verification pass

**Files:** none (verification only, per §13 of the original brief — local review, no push)

- [ ] **Step 1: Full backend typecheck + build**

Run: `pnpm --filter ./apps/backend typecheck && pnpm --filter ./apps/backend build`
Expected: both pass with zero errors.

- [ ] **Step 2: Full frontend typecheck + build**

Run: `pnpm --filter ./apps/frontend typecheck && pnpm --filter ./apps/frontend build`
Expected: both pass with zero errors.

- [ ] **Step 3: Run the full local flow in a browser**, per spec §10's frontend checklist:
signup → `/apply`, Apply Now → `/apply`, manual fill + refresh-resume, LinkedIn import +
edit-clears-badge, photo upload (valid and invalid file), submit → `/apply/submitted`, re-visit
`/apply` post-submit redirects away. Note any failure found and fix before calling this task done
— per root `CLAUDE.md`, don't claim a UI change works without having actually driven it in a
browser.

- [ ] **Step 4: `git status` review — stage only, do not push**

Run: `git status`, confirm every intended file is tracked/committed from Tasks 1-10, no stray
debug files, no `.env*` staged. Leave the branch as-is for the user's local review — no `git push`.
