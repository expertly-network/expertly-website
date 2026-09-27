# Admin Application Review Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AdminApplicationsTable.tsx`'s inline approve/reject-in-a-row UI with a full
`/admin/applications/[id]` detail page — read-only render of everything the applicant submitted,
plus a decision panel (approve: service + tier + membership start date; reject: reason) — backed by
a new `GET /v1/admin/applications/:id` endpoint and two new optional fields on the existing
`PATCH /v1/admin/applications/:id` review request.

**Architecture:** Backend reuses the existing `findByIdForReview()` + `toDto()` path
(`reviewApplication()` already calls both internally) behind a thin new controller route — no new
repository method, no new response DTO class. Frontend extracts `ReviewRow`/`ReviewListRow` out of
the applicant-facing `ReviewSubmitStep.tsx` into a shared presentational file, builds a new
`ApplicationReviewDetail` client component around them plus the ported approve/reject panel, and a
new server-component page mirroring `admin/events/[id]/edit/page.tsx`'s auth-gate pattern.
`AdminApplicationsTable.tsx` drops to a plain server-renderable list with a "Review" link per row.

**Tech Stack:** NestJS (Fastify), class-validator, Supabase (service-role client), Next.js App
Router (Server Components for data fetching, a client component for the decision panel), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-27-admin-application-review-detail-design.md`

**No test runner exists in this repo** (confirmed by search — no `.spec.ts`/`.test.ts(x)` files,
no jest config in either `apps/backend` or `apps/frontend`). Every task below verifies with
`pnpm typecheck` plus a concrete manual check (curl command with expected output, or a browser
step) instead of an automated test step — this matches the verification method root `CLAUDE.md`
and `apps/frontend/CLAUDE.md` already prescribe for this codebase.

## Global Constraints

- Base path `/v1`; this is an additive change (new optional DTO fields, new endpoint) — no version
  bump.
- No new database migration — `member_profiles.member_tier`/`membership_started_at` already exist.
- No `member_profiles.approved_by` column (confirmed decision — see spec §2.1).
- The detail page is read-only for everything the applicant submitted; only service/tier/start
  date are admin-decided at approval. Don't make bio/rates/work-history/etc. editable here.
- Every new/modified route needs the repo's 🌐/🔒/🔑/🛡️ one-line marker comment.
- Frontend: Tailwind only, tokens from `docs/design-system.md`, `components/ui/*` base components,
  mobile-first checked at 375px and 1440px, loading/error/empty states.

---

## Backend phase

### Task 1: Shared request/response type changes

**Files:**
- Modify: `packages/shared-types/membership-application.ts`

**Interfaces:**
- Produces: `ApplicationDto.backgroundCheckConsent: boolean | null`,
  `ApplicationDto.termsVersionAgreed: string | null`, `ApplicationDto.privacyVersionAgreed: string | null`,
  `ApplicationDto.rejectionReason: string | null` — consumed by Task 3's `toDto()` and Task 8's
  `ApplicationReviewDetail`.
- Produces: `AdminApplicationReviewRequest.memberTier?: MembershipTier`,
  `AdminApplicationReviewRequest.membershipStartedAt?: string` — consumed by Task 2's
  `ReviewApplicationDto` and Task 4's `reviewApplication()`.

- [ ] **Step 1: Add the three consent fields to `ApplicationDto`**

In `packages/shared-types/membership-application.ts`, find the `ApplicationDto` class. Immediately
after the existing `linkedinImportConsent` line, add:

```ts
  @ApiProperty({ nullable: true, type: Boolean }) backgroundCheckConsent!: boolean | null;
  @ApiProperty({ nullable: true, type: String }) termsVersionAgreed!: string | null;
  @ApiProperty({ nullable: true, type: String }) privacyVersionAgreed!: string | null;
```

Also, immediately after the existing `@ApiProperty() createdAt!: string;` line at the end of the
same class, add:

```ts
  /** Set only once status is 'rejected'. */
  @ApiProperty({ nullable: true, type: String }) rejectionReason!: string | null;
```

(`rejection_reason` is already a `membership_applications` column and already part of
`APPLICATION_ROW_COLUMNS` — Task 8's detail page needs this to show why a rejected application was
rejected, and it was missing from `ApplicationDto` today.)

- [ ] **Step 2: Add `memberTier`/`membershipStartedAt` to `AdminApplicationReviewRequest`**

In the same file, find `AdminApplicationReviewRequest`. After the `approvedServiceId` field, add:

```ts
  /**
   * Optional admin override, only used when status is 'approved'. Falls back to the applicant's
   * own computed selectedTier when omitted.
   */
  @ApiPropertyOptional({ enum: ['budding_entrepreneur', 'seasoned_professional'] })
  memberTier?: MembershipTier;
  /**
   * Optional, only used when status is 'approved'. ISO date string. Defaults to today when
   * omitted — see docs/rest-api.md.
   */
  @ApiPropertyOptional() membershipStartedAt?: string;
```

`MembershipTier` is already exported earlier in this same file, so no new import is needed.

- [ ] **Step 3: Typecheck the shared-types package**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/membership-application.ts
git commit -m "feat(shared-types): add application consent fields and admin review tier/start-date overrides"
```

---

### Task 2: Backend DTO validation for the two new review fields

**Files:**
- Modify: `apps/backend/src/applications/dto/review-application.dto.ts`

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `ReviewApplicationDto.memberTier?: 'budding_entrepreneur' | 'seasoned_professional'`,
  `ReviewApplicationDto.membershipStartedAt?: string` — consumed by Task 4's `reviewApplication()`.

- [ ] **Step 1: Add the two fields with validation**

Replace the full contents of `apps/backend/src/applications/dto/review-application.dto.ts` with:

```ts
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import type { MembershipTier } from '@shared/membership-application';

const MEMBER_TIERS: MembershipTier[] = ['budding_entrepreneur', 'seasoned_professional'];

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  // Required when status is 'rejected'.
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  // Required when status is 'approved' — must be one of the applicant's own submitted
  // service_preferences. Approving no longer auto-provisions every submitted preference.
  @IsOptional()
  @IsString()
  approvedServiceId?: string;

  // Optional admin override, only used when status is 'approved'. Falls back to the applicant's
  // own computed selectedTier when omitted — see ApplicationsService.reviewApplication().
  @IsOptional()
  @IsIn(MEMBER_TIERS)
  memberTier?: MembershipTier;

  // Optional, only used when status is 'approved'. Defaults to "now" when omitted.
  @IsOptional()
  @IsDateString()
  membershipStartedAt?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/backend && pnpm typecheck` (or `./node_modules/.bin/tsc --noEmit` from
`apps/backend/` if `pnpm` isn't available in your environment)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/applications/dto/review-application.dto.ts
git commit -m "feat(backend): validate memberTier/membershipStartedAt on application review"
```

---

### Task 3: `GET /v1/admin/applications/:id` + consent fields in `toDto()`

**Files:**
- Modify: `apps/backend/src/applications/applications.service.ts`
- Modify: `apps/backend/src/applications/admin-applications.controller.ts`

**Interfaces:**
- Consumes: `ApplicationsRepository.findByIdForReview(id): Promise<ApplicationRow>` (already
  exists, `apps/backend/src/applications/applications.repository.ts:162`).
- Produces: `ApplicationsService.getForReview(id: string): Promise<ApplicationDto>` — consumed by
  Task 8's `getAdminApplicationServer()`.

- [ ] **Step 1: Add the three consent fields to `toDto()`**

In `apps/backend/src/applications/applications.service.ts`, find the private `toDto()` method.
Immediately after the `linkedinImportConsent: row.linkedin_import_consent,` line, add:

```ts
      backgroundCheckConsent: row.background_check_consent,
      termsVersionAgreed: row.terms_version_agreed,
      privacyVersionAgreed: row.privacy_version_agreed,
```

Then find the final `createdAt: row.created_at,` line (last line before the closing `};` of the
returned object) and add immediately after it:

```ts
      rejectionReason: row.rejection_reason,
```

(These three columns are already part of `APPLICATION_ROW_COLUMNS` in `applications.repository.ts`
— every query that returns a full `ApplicationRow`, including `findByIdForReview()`, already
selects them. No repository change needed.)

- [ ] **Step 2: Add `getForReview()`**

In the same file, immediately after the `listForReview()` method (right before the
`reviewApplication()` method), add:

```ts
  // 🛡️ manageApplications — the exact same ApplicationDto shape the applicant sees on their own
  // review step, for the admin detail page.
  async getForReview(id: string): Promise<ApplicationDto> {
    const application = await this.applicationsRepository.findByIdForReview(id);
    const serviceDetails = await this.resolveServiceDetails(application.service_preferences ?? []);
    return this.toDto(application, serviceDetails);
  }
```

- [ ] **Step 3: Add the controller route**

In `apps/backend/src/applications/admin-applications.controller.ts`, add the `ApplicationDto`
import and the new route. The full file becomes:

```ts
import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminApplicationListItemDto,
  ApplicationDto,
  ApplicationStatus,
} from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { ReviewApplicationDto } from './dto/review-application.dto';

// 🛡️ manageApplications — admin review queue.
@Roles('admin')
@RequiresPermission('manageApplications')
@Controller('admin')
export class AdminApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Defaults to the review queue (submitted + under_review) when status is omitted.
  @Get('applications')
  list(@Query('status') status?: ApplicationStatus): Promise<AdminApplicationListItemDto[]> {
    return this.applicationsService.listForReview(status);
  }

  // Full detail for the review page — same ApplicationDto shape as the applicant's own
  // GET /v1/applications/me.
  @Get('applications/:id')
  getOne(@Param('id') id: string): Promise<ApplicationDto> {
    return this.applicationsService.getForReview(id);
  }

  @Patch('applications/:id')
  review(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewApplicationDto
  ) {
    return this.applicationsService.reviewApplication(id, admin, dto);
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification (dev server + curl)**

Start the backend (`pnpm --filter ./apps/backend dev` from repo root, or however you normally run
it locally). Get an admin bearer token (log in as an admin account via the frontend or Supabase
directly, copy the access token), and a known application id (e.g. from
`GET /v1/admin/applications`).

Run:
```bash
curl -s http://localhost:<port>/v1/admin/applications/<applicationId> \
  -H "Authorization: Bearer <adminAccessToken>" | jq
```
Expected: `200`, a JSON body shaped like `ApplicationDto` (envelope per `ResponseInterceptor`),
including non-null `backgroundCheckConsent`/`termsVersionAgreed`/`privacyVersionAgreed` for a
submitted application, and `servicePreferences[]` populated.

Run without a token to confirm the guard:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/v1/admin/applications/<applicationId>
```
Expected: `401`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/applications/applications.service.ts apps/backend/src/applications/admin-applications.controller.ts
git commit -m "feat(backend): add GET /v1/admin/applications/:id detail endpoint"
```

---

### Task 4: Wire `memberTier`/`membershipStartedAt` into approval

**Files:**
- Modify: `apps/backend/src/applications/applications.service.ts`

**Interfaces:**
- Consumes: `ReviewApplicationDto.memberTier`/`membershipStartedAt` (Task 2).
- Produces: no new public interface — changes `reviewApplication()`'s internal behavior only.

- [ ] **Step 1: Update the `insertMemberProfile()` call**

In `apps/backend/src/applications/applications.service.ts`, inside `reviewApplication()`, find:

```ts
    await this.applicationsRepository.insertMemberProfile({
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
      // Same bucket, same path as the source application — application-assets is public now, so
      // no file copy and no signing is needed, just carry the path forward as-is.
      photo_path: application.photo_path,
      application_id: application.id,
      is_verified: true,
      status: 'active',
    });
```

Replace with:

```ts
    await this.applicationsRepository.insertMemberProfile({
      profile_id: application.applicant_id,
      bio: application.bio,
      region: application.region,
      country: application.country,
      state: application.state,
      city: application.city,
      years_of_experience: application.years_of_experience,
      rate_min_cents: application.rate_min_cents,
      rate_max_cents: application.rate_max_cents,
      // Admin can override the tier computed at submission; falls back to it when omitted.
      member_tier: dto.memberTier ?? application.selected_tier,
      // Explicit rather than omitted-and-DB-defaulted, so the inserted row's start date is always
      // traceable to a value this call actually decided (the admin's input, or "now" computed
      // here) — same effective default as before, just no longer implicit.
      membership_started_at: dto.membershipStartedAt ?? new Date().toISOString(),
      contact_email: application.contact_email,
      linkedin_url: application.linkedin_url,
      // Same bucket, same path as the source application — application-assets is public now, so
      // no file copy and no signing is needed, just carry the path forward as-is.
      photo_path: application.photo_path,
      application_id: application.id,
      is_verified: true,
      status: 'active',
    });
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification (curl)**

Using a `submitted` application's id, its applicant's real `servicePreferences[].serviceId`, and an
admin bearer token:

```bash
curl -s -X PATCH http://localhost:<port>/v1/admin/applications/<applicationId> \
  -H "Authorization: Bearer <adminAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","approvedServiceId":"<serviceId>","memberTier":"seasoned_professional","membershipStartedAt":"2026-01-15"}' | jq
```
Expected: `200`, `{ "data": { "status": "approved" } }` (per `ResponseInterceptor`'s envelope).
Then confirm the provisioned row directly:
```bash
curl -s http://localhost:<port>/v1/admin/members \
  -H "Authorization: Bearer <adminAccessToken>" | jq '.data[] | select(.applicationId=="<applicationId>")'
```
Expected: `memberTier: "seasoned_professional"`, `membershipStartedAt` starting with
`"2026-01-15"`. Re-run the same PATCH against a *different* submitted application omitting both
new fields — expect `memberTier` equal to that application's `selectedTier` and
`membershipStartedAt` close to "now".

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/applications/applications.service.ts
git commit -m "feat(backend): apply admin tier/start-date overrides on application approval"
```

---

### Task 5: Update `docs/rest-api.md`

**Files:**
- Modify: `docs/rest-api.md`

- [ ] **Step 1: Document the new GET endpoint and the two new PATCH fields**

In the "Membership applications — admin" section, immediately before the existing
`### 🛡️ manageApplications PATCH /v1/admin/applications/:id` heading, add:

```markdown
### 🛡️ `manageApplications` `GET /v1/admin/applications/:id`

Full detail for the admin review page (`apps/frontend/app/(shell)/admin/applications/[id]/`) — the
exact same `ApplicationDto` shape the applicant sees on their own `GET /v1/applications/me`,
including `servicePreferences[]` so the admin can pick which one to approve.

**Response `200`:** `ApplicationDto`. **Errors:** `401`/`403` per the 🛡️ badge · `404` no such
application.

```

Then, in the existing PATCH section's **Request** line, replace:

```markdown
**Request:** `AdminApplicationReviewRequest` — `{ status: 'approved' | 'rejected', rejectionReason?:
string, approvedServiceId?: string }` (`rejectionReason` required when rejecting;
`approvedServiceId` required when approving, as of 2026-09-26).
```

with:

```markdown
**Request:** `AdminApplicationReviewRequest` — `{ status: 'approved' | 'rejected', rejectionReason?:
string, approvedServiceId?: string, memberTier?: MembershipTier, membershipStartedAt?: string }`
(`rejectionReason` required when rejecting; `approvedServiceId` required when approving, as of
2026-09-26). `memberTier`/`membershipStartedAt` are optional admin overrides used only when
approving — added 2026-09-27. `memberTier` falls back to the applicant's own computed
`selectedTier` when omitted; `membershipStartedAt` (ISO date) falls back to "now" when omitted.
Both map directly onto the same `member_profiles.member_tier`/`membership_started_at` columns
`PATCH /v1/admin/members/:id` already treats as admin-editable — this is the same "admin corrects a
lifecycle fact" concept at provisioning time, not a new one.
```

And in the **On approve** paragraph, after the existing sentence ending "...leaves the application
`submitted` (still reviewable) rather than silently `approved` with no member actually
provisioned.", add:

```markdown
`member_profiles.member_tier` is `memberTier` if the admin supplied one, else the application's own
`selected_tier`; `membership_started_at` is `membershipStartedAt` if supplied, else the time of
approval — both set explicitly on insert now, not left to the DB's `now()` default the way
`membership_started_at` used to be. No `member_profiles.approved_by` column — the reviewing admin
is traceable via `member_profiles.application_id` → `membership_applications.reviewed_by` (a
deliberate decision, not a gap — see
`docs/superpowers/specs/2026-09-27-admin-application-review-detail-design.md`).
```

- [ ] **Step 2: Note the `ApplicationDto` consent fields**

In the `### _client_ POST /v1/applications/me` section's **Response `200`** line, replace:

```markdown
**Response `200`:** `ApplicationDto` — the full current record (draft or submitted), including
resolved `servicePreferences[].serviceName`/`categoryId`/`categoryName`, a `photoUrl` (a plain,
permanent public URL built from the Storage path at read time — see the uploads endpoint below),
and `documents[]`.
```

with:

```markdown
**Response `200`:** `ApplicationDto` — the full current record (draft or submitted), including
resolved `servicePreferences[].serviceName`/`categoryId`/`categoryName`, a `photoUrl` (a plain,
permanent public URL built from the Storage path at read time — see the uploads endpoint below),
`documents[]`, and (added 2026-09-27, also surfaced on the admin detail endpoint above)
`backgroundCheckConsent`/`termsVersionAgreed`/`privacyVersionAgreed`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/rest-api.md
git commit -m "docs: document admin application detail endpoint and review overrides"
```

---

## Frontend phase

### Task 6: Extract `ReviewRow`/`ReviewListRow` to a shared file

**Files:**
- Create: `apps/frontend/components/shared/ApplicationReview.tsx`
- Modify: `apps/frontend/components/apply/steps/ReviewSubmitStep.tsx`

**Interfaces:**
- Produces: `ReviewRow(props: { label: string; value: string; multiline?: boolean; href?: string })`,
  `ReviewListRow(props: { label: string; items: { title: string; detail?: string; link?: { href: string; label: string } }[] })`
  — consumed by `ReviewSubmitStep.tsx` (unchanged usage) and Task 7's `ApplicationReviewDetail.tsx`.

- [ ] **Step 1: Create the shared file**

Create `apps/frontend/components/shared/ApplicationReview.tsx`:

```tsx
// Presentational rows shared by the applicant's own review step (ReviewSubmitStep) and the admin
// application review detail page (ApplicationReviewDetail) — both render the same "labeled row" /
// "labeled list of structured entries" layout over their own field mapping, so only the
// presentation lives here.

export function ReviewRow({
  label,
  value,
  multiline,
  href,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  href?: string;
}) {
  return (
    <div className={`grid grid-cols-[140px_1fr] gap-4 px-6 py-3.5 text-sm ${multiline ? 'items-start' : 'items-center'}`}>
      <span className="text-mono-label text-ink-3">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-accent underline hover:text-ink"
        >
          {value}
        </a>
      ) : (
        <span className={`text-ink ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value || '—'}</span>
      )}
    </div>
  );
}

// For fields that are a list of structured entries (work history, education, services, peer
// references) rather than a single value.
export function ReviewListRow({
  label,
  items,
}: {
  label: string;
  items: { title: string; detail?: string; link?: { href: string; label: string } }[];
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4 px-6 py-3.5 text-sm">
      <span className="mt-0.5 text-mono-label text-ink-3">{label}</span>
      {items.length === 0 ? (
        <span className="text-ink">—</span>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <div key={i}>
              <div className="text-ink">{item.title}</div>
              {item.detail && <div className="mt-0.5 text-xs text-ink-3">{item.detail}</div>}
              {item.link && (
                <a
                  href={item.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-block text-xs text-accent underline hover:text-ink"
                >
                  {item.link.label}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `ReviewSubmitStep.tsx` to import instead of define**

In `apps/frontend/components/apply/steps/ReviewSubmitStep.tsx`:

1. Add to the imports near the top: `import { ReviewRow, ReviewListRow } from '@/components/shared/ApplicationReview';`
2. Delete the `function ReviewRow({ ... }) { ... }` and `function ReviewListRow({ ... }) { ... }`
   definitions at the bottom of the file (everything from `function ReviewRow({` through the final
   closing `}` of `ReviewListRow`, i.e. lines 469–537 in the current file).

Nothing else in the file changes — every existing `<ReviewRow .../>`/`<ReviewListRow .../>` call
site keeps working unchanged since the props are identical.

- [ ] **Step 3: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run the frontend dev server, open the membership application wizard as a `client` account, reach
the final review step, and confirm it still renders identically (work history, education,
services, peer references rows all present).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/shared/ApplicationReview.tsx apps/frontend/components/apply/steps/ReviewSubmitStep.tsx
git commit -m "refactor(frontend): extract ReviewRow/ReviewListRow to a shared component"
```

---

### Task 7: `getAdminApplicationServer()` data fetcher

**Files:**
- Modify: `apps/frontend/lib/api/server.ts`

**Interfaces:**
- Produces: `getAdminApplicationServer(id: string): Promise<ApplicationDto | null>` — consumed by
  Task 9's page.

- [ ] **Step 1: Add the fetcher**

In `apps/frontend/lib/api/server.ts`, immediately after `getAdminApplicationsServer()` (the list
fetcher), add:

```ts
// Returns full detail for the admin review page, or null if not found.
export async function getAdminApplicationServer(id: string): Promise<ApplicationDto | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${getApiBaseUrlServer()}/v1/admin/applications/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load application.', res.status);
  }

  return res.json();
}
```

`ApplicationDto` is already imported at the top of this file (used by `getMyApplicationServer()`),
so no new import is needed.

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/lib/api/server.ts
git commit -m "feat(frontend): add getAdminApplicationServer data fetcher"
```

---

### Task 8: `ApplicationReviewDetail` component (read-only view + decision panel)

**Files:**
- Create: `apps/frontend/components/admin/ApplicationReviewDetail.tsx`

**Interfaces:**
- Consumes: `ReviewRow`/`ReviewListRow` (Task 6), `reviewApplication()` from
  `apps/frontend/lib/api/applications.ts` (already exists, now accepts the two new optional
  fields transparently via the extended `AdminApplicationReviewRequest` type from Task 1),
  `ApplicationDto`/`AdminApplicationReviewRequest` from `@shared/membership-application`.
- Produces: `ApplicationReviewDetail(props: { application: ApplicationDto })` — consumed by Task 9's
  page.

- [ ] **Step 1: Write the component**

Create `apps/frontend/components/admin/ApplicationReviewDetail.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Input, Select, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ReviewRow, ReviewListRow } from '@/components/shared/ApplicationReview';
import { reviewApplication } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';
import type { ApplicationDto } from '@shared/membership-application';

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: '1st preference', 2: '2nd preference', 3: '3rd preference' };

const TIER_OPTIONS: { value: 'budding_entrepreneur' | 'seasoned_professional'; label: string }[] = [
  { value: 'budding_entrepreneur', label: 'Budding Entrepreneur' },
  { value: 'seasoned_professional', label: 'Seasoned Professional' },
];

function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toLocaleString()}`;
}

function monthLabel(month: number | undefined): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return month ? (MONTHS[month - 1] ?? '') : '';
}

function formatDateRange(
  startMonth: number | undefined,
  startYear: number,
  isCurrent: boolean,
  endMonth: number | undefined,
  endYear: number | undefined
): string {
  const start = [monthLabel(startMonth), startYear].filter(Boolean).join(' ');
  const end = isCurrent ? 'Present' : [monthLabel(endMonth), endYear].filter(Boolean).join(' ') || '—';
  return `${start} – ${end}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ApplicationReviewDetail({ application }: { application: ApplicationDto }) {
  const router = useRouter();
  const sortedPreferences = [...application.servicePreferences].sort((a, b) => a.priority - b.priority);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [approvedServiceId, setApprovedServiceId] = useState(sortedPreferences[0]?.serviceId ?? '');
  const [memberTier, setMemberTier] = useState(application.selectedTier ?? 'budding_entrepreneur');
  const [membershipStartedAt, setMembershipStartedAt] = useState(todayIsoDate());
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!approvedServiceId) {
      setError('Select which service to approve the applicant for.');
      return;
    }
    setError(null);
    setBusy('approve');
    try {
      await reviewApplication(application.id, {
        status: 'approved',
        approvedServiceId,
        memberTier,
        membershipStartedAt,
      });
      router.push('/admin/applications');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve this application.');
      setBusy(null);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setError(null);
    setBusy('reject');
    try {
      await reviewApplication(application.id, { status: 'rejected', rejectionReason: reason.trim() });
      router.push('/admin/applications');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject this application.');
      setBusy(null);
    }
  }

  const alreadyDecided = application.status === 'approved' || application.status === 'rejected';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="neutral">{application.status.replace('_', ' ')}</Badge>
        {application.rejectionReason && (
          <span className="text-sm text-ink-3">Rejected: {application.rejectionReason}</span>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-bg-card divide-y divide-line">
        <div className="flex items-center gap-[18px] px-6 py-5">
          <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-line-2 bg-bg-alt text-ink-3">
            {application.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={application.photoUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs">No photo</span>
            )}
          </div>
          <div>
            <div className="text-title text-ink">
              {application.firstName} {application.lastName}
            </div>
            <div className="mt-1 text-xs text-ink-3">{application.contactEmail}</div>
          </div>
        </div>
        <ReviewRow label="Phone" value={application.phone ? `${application.phoneCountryCode ?? ''} ${application.phone}` : '—'} />
        <ReviewRow
          label="Location"
          value={[[application.city, application.state, application.country].filter(Boolean).join(', '), application.region]
            .filter(Boolean)
            .join(' · ') || '—'}
        />
        <ReviewRow label="LinkedIn" value={application.linkedinUrl ?? '—'} href={application.linkedinUrl ?? undefined} />
        <ReviewRow label="Bio" value={application.bio ?? '—'} multiline />
        <ReviewRow
          label="Experience"
          value={application.yearsOfExperience != null ? `${application.yearsOfExperience} years` : '—'}
        />
        <ReviewListRow
          label="Work history"
          items={application.workExperiences.map((w) => ({
            title: `${w.title} at ${w.company}`,
            detail: [
              w.city,
              formatDateRange(w.startMonth, w.startYear, w.isCurrent, w.endMonth, w.endYear),
            ]
              .filter(Boolean)
              .join(' · '),
            link: w.companyUrl ? { href: w.companyUrl, label: 'Company site' } : undefined,
          }))}
        />
        <ReviewListRow
          label="Education"
          items={application.educations.map((e) => ({
            title: e.fieldOfStudy ? `${e.degree} in ${e.fieldOfStudy}` : e.degree,
            detail: [e.institution, e.startYear || e.endYear ? `${e.startYear ?? '—'} – ${e.endYear ?? '—'}` : undefined]
              .filter(Boolean)
              .join(' · '),
          }))}
        />
        <ReviewListRow
          label="Services"
          items={sortedPreferences.map((p) => ({
            title: p.customLabel ? `${p.serviceName} (${p.customLabel})` : p.serviceName,
            detail: PRIORITY_LABEL[p.priority],
          }))}
        />
        <ReviewRow
          label="Rate"
          value={
            application.rateMinCents != null && application.rateMaxCents != null
              ? `${formatCents(application.rateMinCents)} – ${formatCents(application.rateMaxCents)} / hour`
              : '—'
          }
        />
        <ReviewListRow
          label="Peer references"
          items={application.peerReferences.map((r) => ({
            title: r.relationship ? `${r.name} — ${r.relationship}` : r.name,
            detail: [r.email, r.phone].filter(Boolean).join(' · '),
          }))}
        />
        <ReviewListRow
          label="Documents"
          items={application.documents.map((d) => ({
            title: d.filename,
            detail: `${(d.sizeBytes / 1024).toFixed(0)} KB`,
            link: { href: d.url, label: 'View' },
          }))}
        />
        <ReviewRow label="LinkedIn import consent" value={application.linkedinImportConsent ? 'Yes' : 'No'} />
        <ReviewRow label="Background check consent" value={application.backgroundCheckConsent ? 'Yes' : 'No'} />
        <ReviewRow label="Terms agreed" value={application.termsVersionAgreed ?? '—'} />
        <ReviewRow label="Privacy policy agreed" value={application.privacyVersionAgreed ?? '—'} />
      </div>

      {!alreadyDecided && (
        <Card padding="md">
          <h2 className="text-title text-ink">Decision</h2>
          <p className="mt-1 text-sm text-ink-3">
            Approving provisions a member profile and promotes this applicant&apos;s account to{' '}
            <code>member</code> immediately.
          </p>

          <div className="mt-5 flex flex-col gap-6 max-[720px]:gap-5 sm:flex-row sm:flex-wrap">
            <div className="flex w-full flex-col gap-4 rounded-input border border-line-2 p-4 sm:max-w-sm">
              <span className="text-mono-label text-ink-3">Approve</span>
              <Select
                label="Approve for service"
                value={approvedServiceId}
                onChange={(e) => setApprovedServiceId(e.target.value)}
                disabled={sortedPreferences.length === 0}
              >
                {sortedPreferences.map((p) => (
                  <option key={p.serviceId} value={p.serviceId}>
                    {p.customLabel ? `${p.serviceName} (${p.customLabel})` : p.serviceName} — priority {p.priority}
                  </option>
                ))}
              </Select>
              <Select label="Member tier" value={memberTier} onChange={(e) => setMemberTier(e.target.value as typeof memberTier)}>
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Input
                type="date"
                label="Membership start date"
                value={membershipStartedAt}
                onChange={(e) => setMembershipStartedAt(e.target.value)}
              />
              <Button onClick={approve} disabled={busy !== null || sortedPreferences.length === 0}>
                {busy === 'approve' ? 'Approving…' : 'Approve application'}
              </Button>
            </div>

            <div className="flex w-full flex-col gap-4 rounded-input border border-line-2 p-4 sm:max-w-sm">
              <span className="text-mono-label text-ink-3">Reject</span>
              {rejecting ? (
                <>
                  <Textarea label="Rejection reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={reject} disabled={busy !== null}>
                      {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
                    </Button>
                    <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy !== null}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
                  Reject application
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4">
              <ErrorBanner message={error} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/admin/ApplicationReviewDetail.tsx
git commit -m "feat(frontend): add ApplicationReviewDetail read-only view and decision panel"
```

---

### Task 9: `/admin/applications/[id]` page

**Files:**
- Create: `apps/frontend/app/(shell)/admin/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `getAdminApplicationServer(id)` (Task 7), `ApplicationReviewDetail` (Task 8).

- [ ] **Step 1: Write the page**

Create `apps/frontend/app/(shell)/admin/applications/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminApplicationServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { ApplicationReviewDetail } from '@/components/admin/ApplicationReviewDetail';

export const metadata = {
  title: 'Review application — Admin — Expertly',
};

export default async function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/applications/${params.id}`);
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const application = await getAdminApplicationServer(params.id);
  if (!application) {
    notFound();
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">
            {application.firstName} {application.lastName}
          </h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">Review this membership application.</p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <ApplicationReviewDetail application={application} />
        </PageContainer>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/app/(shell)/admin/applications/[id]/page.tsx"
git commit -m "feat(frontend): add /admin/applications/[id] detail page"
```

---

### Task 10: Simplify `AdminApplicationsTable.tsx` to a plain list with a Review link

**Files:**
- Modify: `apps/frontend/components/admin/AdminApplicationsTable.tsx`

- [ ] **Step 1: Replace the file**

Replace the full contents of `apps/frontend/components/admin/AdminApplicationsTable.tsx` with:

```tsx
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import type { AdminApplicationListItemDto } from '@shared/membership-application';

function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toLocaleString()}`;
}

const TIER_LABEL: Record<string, string> = {
  budding_entrepreneur: 'Budding Entrepreneur',
  seasoned_professional: 'Seasoned Professional',
};

export function AdminApplicationsTable({
  initialApplications,
}: {
  initialApplications: AdminApplicationListItemDto[];
}) {
  if (initialApplications.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-3">All caught up — nothing left to review.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-bg-alt text-left text-xs font-medium text-ink-3">
            <th className="px-6 py-3">Applicant</th>
            <th className="px-6 py-3">Tier</th>
            <th className="px-6 py-3">Payment</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">
              <span className="sr-only">Review</span>
            </th>
          </tr>
        </thead>
        <tbody className="px-6">
          {initialApplications.map((application) => (
            <tr key={application.id} className="border-b border-line align-top last:border-b-0">
              <td className="px-6 py-4">
                <div className="font-medium text-ink">
                  {application.firstName} {application.lastName}
                </div>
                <div className="text-xs text-ink-3">{application.contactEmail}</div>
                <div className="mt-1 text-xs text-ink-3">{application.country}</div>
              </td>
              <td className="px-6 py-4 text-sm text-ink-2">
                {application.selectedTier ? TIER_LABEL[application.selectedTier] ?? application.selectedTier : '—'}
                {application.billingPeriod && <span className="text-ink-3"> · {application.billingPeriod}</span>}
              </td>
              <td className="px-6 py-4 text-sm text-ink-2">
                {formatCents(application.amountDueCents)}
                <div>
                  <Badge variant={application.paymentStatus === 'paid' ? 'brand' : 'neutral'}>
                    {application.paymentStatus}
                  </Badge>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-ink-2">
                <Badge variant="neutral">{application.status.replace('_', ' ')}</Badge>
              </td>
              <td className="px-6 py-4">
                <Link href={`/admin/applications/${application.id}`}>
                  <Button size="sm" variant="secondary">
                    Review
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

This drops `'use client'` — the component is now pure server-renderable markup (a link + static
rows), no `useState`/`reviewApplication` left, so there's no interactivity requiring a Client
Component boundary here anymore.

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Manual check (browser, both widths)**

Run the frontend dev server, sign in as an admin, open `/admin/applications`:
- At 1440px: table renders with a "Review" button per row; clicking it navigates to
  `/admin/applications/<id>` and shows the full detail page.
- At 375px: table scrolls horizontally within its `overflow-x-auto` wrapper (matches the existing
  pattern — this table was already not mobile-reflowed pre-change, only the row actions changed).
- On the detail page at 375px: the decision panel's two cards (`Approve`/`Reject`) stack vertically
  (the `flex-col sm:flex-row` handles this) rather than overflowing.
- Approve an application end-to-end (service + tier + start date), confirm redirect to
  `/admin/applications` and that the approved application no longer appears in the list (page
  re-fetches server-side on navigation).
- Reject an application end-to-end (reason required — try submitting blank first, confirm the
  inline error), confirm redirect and removal from the list.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/components/admin/AdminApplicationsTable.tsx
git commit -m "refactor(frontend): simplify AdminApplicationsTable to a plain list with a Review link"
```

---

### Task 11: Update `docs/user-stories.md` US-08

**Files:**
- Modify: `docs/user-stories.md`

- [ ] **Step 1: Expand US-08-01's acceptance criteria**

Find the `### US-08-01: Reviewing and deciding on an application` section. Replace:

```markdown
### US-08-01: Reviewing and deciding on an application
As an admin with `manageApplications` permission, I want to review a submitted application and
approve, reject, or waitlist it.
- [ ] Gated by `@RequirePermission('manageApplications')`, not a bare `admin` role check — a
      `reviewer` sub-tier has exactly this permission and nothing else destructive
- [ ] Approval triggers the role transition described in US-04-01
```

with:

```markdown
### US-08-01: Reviewing and deciding on an application
As an admin with `manageApplications` permission, I want to review a submitted application on its
own detail page — everything the applicant submitted, read-only — and approve or reject it.
- [x] Gated by `@RequirePermission('manageApplications')`, not a bare `admin` role check — a
      `reviewer` sub-tier has exactly this permission and nothing else destructive
- [x] `GET /v1/admin/applications/:id` (full detail) + `PATCH /v1/admin/applications/:id`
      (decision) per `docs/rest-api.md`
- [x] Approval triggers the role transition described in US-04-01
- [x] Approving lets the admin choose exactly one of the applicant's submitted service
      preferences, override the computed member tier, and set the membership start date — all
      three are admin-decided at provisioning time, not corrections to what the applicant
      submitted (those go through the separate `member_profile_edits` flow, US-09-01)
- [x] Rejecting requires a reason, visible on the detail page after the fact
- [x] The detail page is read-only for everything the applicant submitted (identity, bio, work
      history, education, peer references, documents, photo, consents) — no inline editing of
      applicant-submitted data
```

- [ ] **Step 2: Commit**

```bash
git add docs/user-stories.md
git commit -m "docs: update US-08 acceptance criteria for the admin application detail page"
```

---

## Final verification

- [ ] **Step 1: Full workspace typecheck**

Run: `pnpm typecheck` from the repo root (Turbo runs it across all three packages).
Expected: no errors in `apps/backend`, `apps/frontend`, or `packages/shared-types`.

- [ ] **Step 2: Re-run the Task 10 browser checklist once more end-to-end**, including the
      already-decided state: navigate directly to an already-`approved`/`rejected` application's
      detail URL and confirm the decision panel is hidden (`alreadyDecided` branch) and the
      rejection reason (if rejected) is visible.

- [ ] **Step 3: Session closing checklist** (per root `CLAUDE.md`) — confirm against the actual
      diff before reporting done: every file created/modified listed, US-08 acceptance criteria
      met, `docs/rest-api.md`/`packages/shared-types/` updated, no hardcoded credentials, `pnpm
      typecheck` passes.
