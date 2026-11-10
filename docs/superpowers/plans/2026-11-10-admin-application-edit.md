# Admin Application Review — Corrections, Any-Service Approval, Full Service Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin correct an applicant's details (applied only to the member profile created on approval), approve them for any active service, and see every preference's full service path.

**Architecture:** The existing `PATCH /v1/admin/applications/:id` gains an optional `profileOverrides` object and a relaxed `approvedServiceId`. The service merges overrides onto an in-memory copy of the application row (`applyProfileOverrides`) and runs the existing approve logic on that copy, so the stored application is never written beyond the decision columns. The frontend edits a `WizardFormState` seeded from the application (reusing the wizard's field components and mappers) and sends only the changed fields.

**Tech Stack:** NestJS 11 (Fastify) + class-validator, Supabase (service-role client), Vitest; Next.js App Router, Tailwind, `components/ui/*`.

**Spec:** `docs/superpowers/specs/2026-11-10-admin-application-edit-design.md`

## Global Constraints

- Work in worktree `.claude/worktrees/feature+admin-application-edit`, branch `feature/admin-application-edit`. Never push or merge without the user's go-ahead.
- TypeScript strict, no `any`. NestJS `Logger`, never `console.log`. Errors are Nest HTTP exceptions with `{ code, message }`.
- Contract is additive under `/v1`. `docs/rest-api.md`, `packages/shared-types/membership-application.ts` and `postman/GrowXQ.postman_collection.json` change in the same change (Task 4).
- No database migration.
- The application row is never updated except via the existing `claimForDecision` / `revertDecision`.
- Frontend: `import type` from `@shared/*` only; `components/ui/*`; Tailwind only, design tokens only (no hex); mobile-first, checked at 375 px and 1440 px.
- Backend tests: `pnpm --filter ./apps/backend exec vitest run <file>`. Frontend tests: `pnpm --filter ./apps/frontend exec vitest run <file>`.
- Before declaring done: `pnpm verify` from the worktree root (not `verify:full` — the user's dev server may be running).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Resolve the service line for every service preference

**Files:**
- Modify: `apps/backend/src/applications/applications.repository.ts` (`ServiceDetail` ~line 140, `findServiceDetails` ~line 329, accessors ~line 168)
- Modify: `apps/backend/src/applications/applications.service.ts` (`toServicePreferences` ~line 836)
- Modify: `packages/shared-types/membership-application.ts` (`ServicePreference` ~line 66)
- Test: `apps/backend/src/applications/service-details.spec.ts` (create)

**Interfaces:**
- Produces: `ServiceDetail` gains `serviceLineId: string; serviceLineName: string`. `ServicePreference` (shared) gains `serviceLineId: string; serviceLineName: string`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/backend/src/applications/service-details.spec.ts
import { describe, expect, it } from 'vitest';
import { ApplicationsRepository } from './applications.repository';
import { fakeSupabaseService } from '../../test/helpers/fake-supabase';

describe('ApplicationsRepository.findServiceDetails', () => {
  it('resolves category and service line names for each service', async () => {
    const { service } = fakeSupabaseService((call) => {
      if (call.table === 'services')
        return { data: [{ id: 's1', name: 'Benchmarking', category_id: 'c1', is_custom: false, is_active: true }] };
      if (call.table === 'categories') return { data: [{ id: 'c1', name: 'Transfer Pricing', service_line_id: 'l1' }] };
      if (call.table === 'service_lines') return { data: [{ id: 'l1', name: 'Tax' }] };
      return { data: [] };
    });
    const repo = new ApplicationsRepository(service);

    const details = await repo.findServiceDetails(['s1']);

    expect(details.get('s1')).toEqual({
      name: 'Benchmarking',
      categoryId: 'c1',
      categoryName: 'Transfer Pricing',
      serviceLineId: 'l1',
      serviceLineName: 'Tax',
      isCustom: false,
      isActive: true,
    });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`serviceLineId` missing)

Run: `pnpm --filter ./apps/backend exec vitest run src/applications/service-details.spec.ts`

- [ ] **Step 3: Implement**

In `applications.repository.ts`:

```ts
export interface ServiceDetail {
  name: string;
  categoryId: string;
  categoryName: string;
  serviceLineId: string;
  serviceLineName: string;
  isCustom: boolean;
  isActive: boolean;
}
```

Add next to `categories()`:

```ts
  private serviceLines() {
    return this.supabase.db.from('service_lines');
  }
```

Replace the category block and return of `findServiceDetails`:

```ts
    const categoryIds = [...new Set((services ?? []).map((s) => s.category_id as string))];
    const categoryById = new Map<string, { name: string; serviceLineId: string }>();
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await this.categories()
        .select('id, name, service_line_id')
        .in('id', categoryIds);
      if (categoriesError) throw new InternalServerErrorException('Failed to resolve categories.');
      for (const c of categories ?? [])
        categoryById.set(c.id as string, { name: c.name as string, serviceLineId: c.service_line_id as string });
    }

    const lineIds = [...new Set([...categoryById.values()].map((c) => c.serviceLineId))];
    const lineNameById = new Map<string, string>();
    if (lineIds.length > 0) {
      const { data: lines, error: linesError } = await this.serviceLines().select('id, name').in('id', lineIds);
      if (linesError) throw new InternalServerErrorException('Failed to resolve service lines.');
      for (const l of lines ?? []) lineNameById.set(l.id as string, l.name as string);
    }

    return new Map(
      (services ?? []).map((s) => {
        const category = categoryById.get(s.category_id as string);
        return [
          s.id as string,
          {
            name: s.name as string,
            categoryId: s.category_id as string,
            categoryName: category?.name ?? 'Unknown',
            serviceLineId: category?.serviceLineId ?? '',
            serviceLineName: (category && lineNameById.get(category.serviceLineId)) ?? 'Unknown',
            isCustom: s.is_custom as boolean,
            isActive: s.is_active as boolean,
          },
        ];
      })
    );
```

In `toServicePreferences` (service), add after `categoryName`:

```ts
        serviceLineId: detail?.serviceLineId ?? '',
        serviceLineName: detail?.serviceLineName ?? 'Unknown',
```

In `packages/shared-types/membership-application.ts`, `ServicePreference`:

```ts
export class ServicePreference extends ServicePreferenceInput {
  /** Resolved server-side for display — not required on input. */
  @ApiProperty() serviceName!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() categoryName!: string;
  /** Taxonomy level 1 (Tax, Legal, …) — service names repeat across categories, so show the full path. */
  @ApiProperty() serviceLineId!: string;
  @ApiProperty() serviceLineName!: string;
}
```

Fix any other `ServiceDetail` literal the compiler flags (`pnpm --filter ./apps/backend typecheck`), e.g. test fixtures — add `serviceLineId: 'l1', serviceLineName: 'Tax'`.

- [ ] **Step 4: Run test + backend typecheck — expect PASS**

Run: `pnpm --filter ./apps/backend exec vitest run src/applications/service-details.spec.ts && pnpm --filter ./apps/backend typecheck`

- [ ] **Step 5: Commit** — `feat(applications): resolve service line on service preferences`

---

### Task 2: Profile-overrides DTO and the pure merge

**Files:**
- Create: `apps/backend/src/applications/dto/profile-overrides.dto.ts`
- Create: `apps/backend/src/applications/profile-overrides.ts`
- Test: `apps/backend/src/applications/profile-overrides.spec.ts`

**Interfaces:**
- Consumes: `UpdateApplicationDto` (its validation metadata), `ApplicationRow`, `computeTier` from `./constants/pricing`.
- Produces:
  - `class ProfileOverridesDto` — every key optional: `firstName, lastName, contactEmail, workEmail, phoneCountryCode, phone, region, country, state, city, linkedinUrl, bio, yearsOfExperience, rateMinCents, rateMaxCents, workExperiences, educations`.
  - `applyProfileOverrides(row: ApplicationRow, overrides: ProfileOverridesDto | undefined): ApplicationRow` — returns a new row; never mutates.
  - `resolveMemberTier(row: ApplicationRow, explicit: MembershipTier | undefined, overrides: ProfileOverridesDto | undefined): MembershipTier | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/backend/src/applications/profile-overrides.spec.ts
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ApplicationRow } from './applications.repository';
import { ProfileOverridesDto } from './dto/profile-overrides.dto';
import { applyProfileOverrides, resolveMemberTier } from './profile-overrides';

const row = {
  id: 'app-1',
  first_name: 'Alex',
  last_name: 'Morgan',
  work_email: 'old@work.example',
  country: null,
  years_of_experience: 10,
  selected_tier: 'budding_entrepreneur',
  rate_min_cents: 2000,
  rate_max_cents: 10000,
  work_experiences: [{ title: 'Associate', company: 'Old', startYear: 2015, isCurrent: true }],
  educations: [{ institution: 'Uni', degree: 'LLB' }],
} as unknown as ApplicationRow;

describe('applyProfileOverrides', () => {
  it('returns the row unchanged (but a copy) when there are no overrides', () => {
    const merged = applyProfileOverrides(row, undefined);
    expect(merged).toEqual(row);
    expect(merged).not.toBe(row);
  });

  it('maps camelCase overrides onto snake_case columns without touching the original', () => {
    const merged = applyProfileOverrides(row, {
      workEmail: 'new@work.example',
      country: 'India',
      yearsOfExperience: 14,
      educations: [{ institution: 'NLSIU', degree: 'LLM' }],
    });
    expect(merged.work_email).toBe('new@work.example');
    expect(merged.country).toBe('India');
    expect(merged.years_of_experience).toBe(14);
    expect(merged.educations).toEqual([{ institution: 'NLSIU', degree: 'LLM' }]);
    expect(merged.first_name).toBe('Alex');
    expect(row.work_email).toBe('old@work.example');
    expect(row.country).toBeNull();
  });
});

describe('resolveMemberTier', () => {
  it('prefers an explicit tier', () => {
    expect(resolveMemberTier(row, 'seasoned_professional', { yearsOfExperience: 6 })).toBe('seasoned_professional');
  });
  it('recomputes from overridden years when no explicit tier', () => {
    expect(resolveMemberTier(row, undefined, { yearsOfExperience: 14 })).toBe('seasoned_professional');
  });
  it("falls back to the application's tier", () => {
    expect(resolveMemberTier(row, undefined, undefined)).toBe('budding_entrepreneur');
  });
});

describe('ProfileOverridesDto validation', () => {
  it('accepts a valid partial body', async () => {
    const dto = plainToInstance(ProfileOverridesDto, { workEmail: 'a@b.co', yearsOfExperience: 12 });
    expect(await validate(dto, { forbidNonWhitelisted: true, whitelist: true })).toHaveLength(0);
  });
  it('rejects a bad email and an unknown key', async () => {
    const dto = plainToInstance(ProfileOverridesDto, { workEmail: 'nope', couponCode: 'X' });
    const errors = await validate(dto, { forbidNonWhitelisted: true, whitelist: true });
    expect(errors.map((e) => e.property).sort()).toEqual(['couponCode', 'workEmail']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (modules missing)

Run: `pnpm --filter ./apps/backend exec vitest run src/applications/profile-overrides.spec.ts`

- [ ] **Step 3: Implement**

```ts
// apps/backend/src/applications/dto/profile-overrides.dto.ts
import { PartialType, PickType } from '@nestjs/swagger';
import { UpdateApplicationDto } from './update-application.dto';

// Admin corrections applied to the member profile on approval (never to the application). Same
// validators and limits as the applicant's own fields, so an admin can't store what an applicant
// couldn't. PickType/PartialType from @nestjs/swagger carry class-validator metadata over.
export class ProfileOverridesDto extends PartialType(
  PickType(UpdateApplicationDto, [
    'firstName',
    'lastName',
    'contactEmail',
    'workEmail',
    'phoneCountryCode',
    'phone',
    'region',
    'country',
    'state',
    'city',
    'linkedinUrl',
    'bio',
    'yearsOfExperience',
    'rateMinCents',
    'rateMaxCents',
    'workExperiences',
    'educations',
  ] as const)
) {}
```

```ts
// apps/backend/src/applications/profile-overrides.ts
import type { MembershipTier } from '@shared/membership-application';
import type { ApplicationRow } from './applications.repository';
import type { ProfileOverridesDto } from './dto/profile-overrides.dto';
import { computeTier } from './constants/pricing';

const COLUMN: { [K in keyof Required<ProfileOverridesDto>]: keyof ApplicationRow } = {
  firstName: 'first_name',
  lastName: 'last_name',
  contactEmail: 'contact_email',
  workEmail: 'work_email',
  phoneCountryCode: 'phone_country_code',
  phone: 'phone',
  region: 'region',
  country: 'country',
  state: 'state',
  city: 'city',
  linkedinUrl: 'linkedin_url',
  bio: 'bio',
  yearsOfExperience: 'years_of_experience',
  rateMinCents: 'rate_min_cents',
  rateMaxCents: 'rate_max_cents',
  workExperiences: 'work_experiences',
  educations: 'educations',
};

/** The application as the member profile should see it: a copy with the admin's corrections on top. */
export function applyProfileOverrides(row: ApplicationRow, overrides: ProfileOverridesDto | undefined): ApplicationRow {
  const merged: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined) continue;
    merged[COLUMN[key as keyof ProfileOverridesDto]] = value;
  }
  return merged as ApplicationRow;
}

/** Explicit admin tier > tier recomputed from corrected years > the applicant's own tier. */
export function resolveMemberTier(
  row: ApplicationRow,
  explicit: MembershipTier | undefined,
  overrides: ProfileOverridesDto | undefined
): MembershipTier | null {
  if (explicit) return explicit;
  if (overrides?.yearsOfExperience !== undefined) return computeTier(overrides.yearsOfExperience);
  return row.selected_tier;
}
```

If `COLUMN`'s type rejects a key (an `ApplicationRow` column name differs), check the column in `ApplicationRow` (`applications.repository.ts:121`) and use its real name.

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter ./apps/backend exec vitest run src/applications/profile-overrides.spec.ts`

- [ ] **Step 5: Commit** — `feat(applications): profile-overrides DTO and merge helpers`

---

### Task 3: Approve with overrides and any service

**Files:**
- Modify: `apps/backend/src/applications/dto/review-application.dto.ts`
- Modify: `apps/backend/src/applications/applications.service.ts` (`reviewApplication` ~line 494, `buildMemberProfile` ~line 618)
- Modify: `apps/backend/src/applications/applications.repository.ts` (`promoteToMember` ~line 305)
- Test: `apps/backend/src/applications/review-application.spec.ts` (create)

**Interfaces:**
- Consumes: `ProfileOverridesDto`, `applyProfileOverrides`, `resolveMemberTier` (Task 2); `ServiceDetail` (Task 1).
- Produces: `ReviewApplicationDto.profileOverrides?: ProfileOverridesDto`; `promoteToMember(applicantId: string, names?: { firstName: string; lastName: string }): Promise<void>`. New error codes `OVERRIDES_ON_REJECT` (400), `INVALID_RATE_RANGE` (400).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/backend/src/applications/review-application.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from './applications.service';
import type { ApplicationsRepository, ApplicationRow, ServiceDetail } from './applications.repository';
import type { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import type { ConsentPoliciesService } from '../consent-policies/consent-policies.service';
import type { EmailService } from '../email/email.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ReviewApplicationDto } from './dto/review-application.dto';

vi.mock('../config/env', () => ({ env: () => ({}) }));

const admin = { id: 'admin-1', role: 'admin' } as AuthenticatedUser;

const detail = (over: Partial<ServiceDetail> = {}): ServiceDetail => ({
  name: 'Benchmarking',
  categoryId: 'c1',
  categoryName: 'Transfer Pricing',
  serviceLineId: 'l1',
  serviceLineName: 'Tax',
  isCustom: false,
  isActive: true,
  ...over,
});

function setup(rowOver: Partial<ApplicationRow> = {}, services: Record<string, ServiceDetail> = {}) {
  const application = {
    id: 'app-1',
    applicant_id: 'user-1',
    status: 'submitted',
    first_name: 'Alex',
    last_name: 'Morgan',
    contact_email: 'alex@example.com',
    work_email: 'old@work.example',
    phone_country_code: '+91',
    phone: '9876543210',
    region: 'south_asia',
    country: 'India',
    state: 'Karnataka',
    city: 'Bengaluru',
    linkedin_url: null,
    bio: 'Bio',
    years_of_experience: 10,
    selected_tier: 'budding_entrepreneur',
    rate_min_cents: 2000,
    rate_max_cents: 10000,
    work_experiences: [{ title: 'Partner', company: 'Firm', startYear: 2020, isCurrent: true }],
    educations: [{ institution: 'Uni', degree: 'LLB' }],
    service_preferences: [{ serviceId: 'pref-1', priority: 1, customLabel: 'GST' }],
    photo_path: null,
    ...rowOver,
  } as unknown as ApplicationRow;
  const repo = {
    findByIdForReview: vi.fn().mockResolvedValue(application),
    claimForDecision: vi.fn().mockResolvedValue(true),
    findUniqueMemberSlug: vi.fn().mockResolvedValue('alex-morgan'),
    insertMemberProfile: vi.fn().mockResolvedValue(undefined),
    insertMemberServices: vi.fn().mockResolvedValue(undefined),
    promoteToMember: vi.fn().mockResolvedValue(undefined),
    deleteMemberProfile: vi.fn().mockResolvedValue(undefined),
    revertDecision: vi.fn().mockResolvedValue(undefined),
    updateById: vi.fn(),
    findServiceDetails: vi.fn(async (ids: string[]) => new Map(ids.filter((id) => services[id]).map((id) => [id, services[id]]))),
  };
  const service = new ApplicationsService(
    repo as unknown as ApplicationsRepository,
    {} as LinkedInImportProvider,
    {} as ConsentPoliciesService,
    { enqueueAutomation: vi.fn() } as unknown as EmailService
  );
  const approve = (dto: Partial<ReviewApplicationDto>) =>
    service.reviewApplication('app-1', admin, { status: 'approved', ...dto } as ReviewApplicationDto);
  return { repo, service, approve, application };
}

describe('reviewApplication — approve', () => {
  it('applies overrides to the member profile and never updates the application', async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await approve({
      approvedServiceId: 'pref-1',
      profileOverrides: { workEmail: 'new@work.example', yearsOfExperience: 14 },
    });
    const profile = repo.insertMemberProfile.mock.calls[0][0];
    expect(profile.work_email).toBe('new@work.example');
    expect(profile.years_of_experience).toBe(14);
    expect(profile.member_tier).toBe('seasoned_professional');
    expect(repo.updateById).not.toHaveBeenCalled();
    expect(repo.promoteToMember).toHaveBeenCalledWith('user-1', undefined);
  });

  it('accepts any active non-custom service and drops the custom label', async () => {
    const { repo, approve } = setup({}, { other: detail() });
    await approve({ approvedServiceId: 'other' });
    expect(repo.insertMemberServices).toHaveBeenCalledWith([
      { member_id: 'user-1', service_id: 'other', custom_label: null },
    ]);
  });

  it("carries the preference's custom label when the service is a preference", async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await approve({ approvedServiceId: 'pref-1' });
    expect(repo.insertMemberServices.mock.calls[0][0][0].custom_label).toBe('GST');
  });

  it.each([
    ['inactive', { other: detail({ isActive: false }) }],
    ['custom, not a preference', { other: detail({ isCustom: true }) }],
    ['unknown', {}],
  ])('rejects a %s service', async (_label, services) => {
    const { approve } = setup({}, services);
    await expect(approve({ approvedServiceId: 'other' })).rejects.toMatchObject({
      response: { code: 'APPROVED_SERVICE_INVALID' },
    });
  });

  it('lets an override fill a missing country', async () => {
    const { repo, approve } = setup({ country: null }, { 'pref-1': detail({ isCustom: true }) });
    await approve({ approvedServiceId: 'pref-1', profileOverrides: { country: 'India' } });
    expect(repo.insertMemberProfile.mock.calls[0][0].country).toBe('India');
  });

  it('rejects a rate range whose max is not above min, before any write', async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await expect(
      approve({ approvedServiceId: 'pref-1', profileOverrides: { rateMinCents: 20000 } })
    ).rejects.toMatchObject({ response: { code: 'INVALID_RATE_RANGE' } });
    expect(repo.claimForDecision).not.toHaveBeenCalled();
  });

  it('renames the account and slugs from the corrected name', async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await approve({ approvedServiceId: 'pref-1', profileOverrides: { lastName: 'Morgan-Shah' } });
    expect(repo.findUniqueMemberSlug).toHaveBeenCalledWith('Alex Morgan-Shah');
    expect(repo.promoteToMember).toHaveBeenCalledWith('user-1', { firstName: 'Alex', lastName: 'Morgan-Shah' });
  });
});

describe('reviewApplication — reject', () => {
  it('refuses overrides on a rejection', async () => {
    const { service } = setup();
    await expect(
      service.reviewApplication('app-1', admin, {
        status: 'rejected',
        rejectionReason: 'No',
        profileOverrides: { bio: 'x' },
      } as ReviewApplicationDto)
    ).rejects.toMatchObject({ response: { code: 'OVERRIDES_ON_REJECT' } });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter ./apps/backend exec vitest run src/applications/review-application.spec.ts`

- [ ] **Step 3: Implement**

`review-application.dto.ts` — update the `approvedServiceId` comment and add the field (imports: `Type` from `class-transformer`, `ValidateNested` from `class-validator`, `ProfileOverridesDto`):

```ts
  // Required when status is 'approved'. Any active, non-custom service in the taxonomy, or one of
  // the applicant's own submitted preferences (which may be a custom service they created).
  @IsOptional()
  @IsUUID()
  approvedServiceId?: string;

  // Optional, approve-only: admin corrections applied to the new member profile. The application
  // itself is never modified. Rejected with OVERRIDES_ON_REJECT on a rejection.
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileOverridesDto)
  profileOverrides?: ProfileOverridesDto;
```

`applications.repository.ts`:

```ts
  // Names are passed only when the admin corrected them on approval; the account row is where a
  // member's displayed name lives.
  async promoteToMember(applicantId: string, names?: { firstName: string; lastName: string }): Promise<void> {
    const patch = names
      ? {
          role: 'member' as const,
          first_name: names.firstName,
          last_name: names.lastName,
          initials: `${names.firstName[0] ?? ''}${names.lastName[0] ?? ''}`.toUpperCase(),
        }
      : { role: 'member' as const };
    const { error } = await this.profiles().update(patch).eq('id', applicantId);
    if (error) throw new InternalServerErrorException('Failed to promote applicant to member.');
  }
```

`applications.service.ts`, in `reviewApplication`:

1. Right after the `REJECTION_REASON_REQUIRED` check, add:

```ts
    if (dto.status === 'rejected' && dto.profileOverrides) {
      throw new BadRequestException({
        code: 'OVERRIDES_ON_REJECT',
        message: 'profileOverrides can only be sent when approving.',
      });
    }
```

2. Replace the approve-time service check (the `!submittedPreferences.some(...)` block) with:

```ts
      const preference = submittedPreferences.find((p) => p.serviceId === dto.approvedServiceId);
      const detail = (await this.applicationsRepository.findServiceDetails([dto.approvedServiceId])).get(
        dto.approvedServiceId
      );
      // A preference may be the applicant's own custom service; anything else must be a regular one.
      if (!detail || !detail.isActive || (!preference && detail.isCustom)) {
        throw new BadRequestException({
          code: 'APPROVED_SERVICE_INVALID',
          message: 'approvedServiceId must be an active service or one of the applicant’s preferences.',
        });
      }
```

3. Replace the `memberTier` / `APPLICATION_INCOMPLETE` block (from `const memberTier = ...` through `const required = ...`) with:

```ts
    // Admin corrections, layered on a copy — the stored application is never written.
    const effective = applyProfileOverrides(application, dto.profileOverrides);
    const memberTier = resolveMemberTier(application, dto.memberTier, dto.profileOverrides);
    if (!effective.country || effective.years_of_experience === null || !memberTier) {
      throw new ConflictException({
        code: 'APPLICATION_INCOMPLETE',
        message: "This application is missing its country, years of experience or tier, so it can't be approved as is.",
      });
    }
    if (
      effective.rate_min_cents !== null &&
      effective.rate_max_cents !== null &&
      effective.rate_max_cents <= effective.rate_min_cents
    ) {
      throw new BadRequestException({
        code: 'INVALID_RATE_RANGE',
        message: 'The maximum rate must be greater than the minimum rate.',
      });
    }
    const required = { country: effective.country, yearsOfExperience: effective.years_of_experience, memberTier };
```

4. In the provisioning block, use `effective` for the profile and slug, the preference's label for the service, and pass names when overridden:

```ts
    let profileCreated = false;
    const renamed = dto.profileOverrides?.firstName !== undefined || dto.profileOverrides?.lastName !== undefined;
    try {
      await withUniqueSlugRetry(
        () => this.applicationsRepository.findUniqueMemberSlug(`${effective.first_name} ${effective.last_name}`),
        (slug) =>
          this.applicationsRepository.insertMemberProfile(this.buildMemberProfile(effective, dto, slug, required))
      );
      profileCreated = true;
      await this.applicationsRepository.insertMemberServices([
        {
          member_id: application.applicant_id,
          service_id: dto.approvedServiceId,
          custom_label: submittedPreferences.find((p) => p.serviceId === dto.approvedServiceId)?.customLabel ?? null,
        },
      ]);
      await this.applicationsRepository.promoteToMember(
        application.applicant_id,
        renamed ? { firstName: effective.first_name ?? '', lastName: effective.last_name ?? '' } : undefined
      );
```

Delete the now-unused `approvedPreference` line. `dto.approvedServiceId` is narrowed only inside the `if (dto.status === 'approved')` block — capture it as `const approvedServiceId = dto.approvedServiceId` after the required-check and use that name in steps 2 and 4 so TypeScript sees a `string`. Keep `rollbackApproval(application, profileCreated)` on the original row. Import `applyProfileOverrides` and `resolveMemberTier` from `./profile-overrides`.

`buildMemberProfile` needs no change — it reads every field from the row it's given, which is now `effective`.

- [ ] **Step 4: Run — expect PASS, plus the whole backend suite**

Run: `pnpm --filter ./apps/backend exec vitest run src/applications/ && pnpm --filter ./apps/backend typecheck`

- [ ] **Step 5: Commit** — `feat(applications): approve with admin corrections and any active service`

---

### Task 4: Contract paperwork — shared types, REST doc, Postman, user story

**Files:**
- Modify: `packages/shared-types/membership-application.ts` (`AdminApplicationReviewRequest` ~line 198)
- Modify: `docs/rest-api.md` (section at ~line 398, `PATCH /v1/admin/applications/:id`; plus the `ServicePreference` shape wherever the doc lists it)
- Modify: `postman/GrowXQ.postman_collection.json` (Admin → Applications → the PATCH request)
- Modify: `docs/user-stories.md` (US-08-01, ~line 267)

**Interfaces:**
- Produces: shared `ApplicationProfileOverrides` type and `AdminApplicationReviewRequest.profileOverrides?: ApplicationProfileOverrides` — used by Task 7/8.

- [ ] **Step 1: Shared types** — add above `AdminApplicationReviewRequest`:

```ts
/** Admin corrections applied to the member profile on approval; the application is never changed. */
export type ApplicationProfileOverrides = Partial<
  Pick<
    UpdateApplicationRequest,
    | 'firstName'
    | 'lastName'
    | 'contactEmail'
    | 'workEmail'
    | 'phoneCountryCode'
    | 'phone'
    | 'region'
    | 'country'
    | 'state'
    | 'city'
    | 'linkedinUrl'
    | 'bio'
    | 'yearsOfExperience'
    | 'rateMinCents'
    | 'rateMaxCents'
    | 'workExperiences'
    | 'educations'
  >
>;
```

(If `UpdateApplicationRequest` is declared below this point, place the type after it.) Rewrite the `approvedServiceId` JSDoc to: "Required when status is 'approved'. Any active, non-custom service, or one of the applicant's own submitted preferences (its customLabel carries over). Exactly this one service is provisioned into member_services." Add:

```ts
  /** Approve only. Corrections for the new member profile — only the fields being changed. */
  @ApiPropertyOptional() profileOverrides?: ApplicationProfileOverrides;
```

- [ ] **Step 2: `docs/rest-api.md`** — in the PATCH section: document `profileOverrides` (field list, same validation as `POST /v1/applications/me`, approve-only, never changes the application, a name change also renames the account), the relaxed `approvedServiceId` rule, tier precedence (explicit → recomputed from corrected years → applicant's), and the two new errors `400 OVERRIDES_ON_REJECT`, `400 INVALID_RATE_RANGE`. Note `APPLICATION_INCOMPLETE` is evaluated after corrections. Add `serviceLineId`, `serviceLineName` to the `ServicePreference` shape.

- [ ] **Step 3: Postman** — in `Admin → Applications → PATCH /admin/applications/:id`, replace the approve body with (keep the existing `approvedServiceId`/`memberTier` variable usage the request already has):

```json
{
  "status": "approved",
  "approvedServiceId": "{{serviceId}}",
  "memberTier": "seasoned_professional",
  "membershipStartedAt": "2026-11-10",
  "profileOverrides": {
    "workEmail": "corrected@firm.example",
    "yearsOfExperience": 14
  }
}
```

Update its description: what `profileOverrides` does, that `approvedServiceId` may be any active service, and keep the reject variant as a ready-to-paste block (`{"status":"rejected","rejectionReason":"…"}`) noting `profileOverrides` must not be sent with it. Validate: `node -e "JSON.parse(require('fs').readFileSync('postman/GrowXQ.postman_collection.json','utf8'))"`.

- [ ] **Step 4: US-08-01** — add acceptance criteria:
  - "Admin can correct names, contact/work email, phone, location, years of experience, rates, bio, LinkedIn, work history and education before approving; corrections go only to the member profile, the application stays as submitted."
  - "Admin can approve the member for any active service, not only their three preferences."
  - "Each preferred service is shown with its full path (service line › category › service) on the review page and the applications list."

- [ ] **Step 5: Typecheck + commit** — `pnpm typecheck`; commit `docs(applications): contract for admin corrections and any-service approval`

---

### Task 5: Show the full service path (frontend)

**Files:**
- Create: `apps/frontend/lib/applications/service-path.ts`
- Test: `apps/frontend/lib/applications/service-path.test.ts`
- Modify: `apps/frontend/components/admin/ApplicationReviewDetail.tsx` (`serviceEntries` ~line 73, decision `<Select>` options ~line 262)
- Modify: `apps/frontend/components/admin/AdminApplicationsTable.tsx` (category cell ~line 236)

**Interfaces:**
- Produces: `serviceLabel(p: ServicePreference): string` ("Benchmarking (GST)") and `servicePath(p: Pick<ServicePreference,'serviceLineName'|'categoryName'>): string` ("Tax › Transfer Pricing").

- [ ] **Step 1: Failing test**

```ts
// apps/frontend/lib/applications/service-path.test.ts
import { describe, expect, it } from 'vitest';
import { serviceLabel, servicePath } from './service-path';

const p = {
  serviceId: 's',
  priority: 1 as const,
  serviceName: 'Benchmarking',
  categoryId: 'c',
  categoryName: 'Transfer Pricing',
  serviceLineId: 'l',
  serviceLineName: 'Tax',
};

describe('service path', () => {
  it('joins service line and category', () => expect(servicePath(p)).toBe('Tax › Transfer Pricing'));
  it('labels with the custom label when present', () => {
    expect(serviceLabel(p)).toBe('Benchmarking');
    expect(serviceLabel({ ...p, customLabel: 'GST' })).toBe('Benchmarking (GST)');
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm --filter ./apps/frontend exec vitest run lib/applications/service-path.test.ts`

- [ ] **Step 3: Implement**

```ts
// apps/frontend/lib/applications/service-path.ts
import type { ServicePreference } from '@shared/membership-application';

/** "Tax › Transfer Pricing" — service names repeat across categories, so always show where one sits. */
export function servicePath(p: Pick<ServicePreference, 'serviceLineName' | 'categoryName'>): string {
  return `${p.serviceLineName} › ${p.categoryName}`;
}

export function serviceLabel(p: Pick<ServicePreference, 'serviceName' | 'customLabel'>): string {
  return p.customLabel ? `${p.serviceName} (${p.customLabel})` : p.serviceName;
}
```

`ApplicationReviewDetail.tsx` — `serviceEntries`:

```ts
    .map((p) => ({
      title: serviceLabel(p),
      detail: `${servicePath(p)} · ${PRIORITY_LABEL[p.priority]}`,
    }));
```

`AdminApplicationsTable.tsx` — service cell uses `serviceLabel(p)`; category cell renders `servicePath(p)` instead of `p.categoryName`. Rename that column's header from "Category" to "Service line › Category" (keep its sort key; make its sort value `servicePath(...)` lower-cased).

(The decision `<Select>` is replaced in Task 8, leave it.)

- [ ] **Step 4: Run test + frontend typecheck — PASS.** `pnpm --filter ./apps/frontend exec vitest run lib/applications && pnpm --filter ./apps/frontend typecheck`

- [ ] **Step 5: Commit** — `feat(admin-ui): show service line › category for every preference`

---

### Task 6: Extract work-history and education fields from the wizard (no behaviour change)

**Why:** the admin editor must reuse the applicant's editors, not copy them (repo rule: never copy a pattern to a second page).

**Files:**
- Create: `apps/frontend/components/apply/useFieldErrors.ts`
- Create: `apps/frontend/components/apply/WorkHistoryFields.tsx`
- Create: `apps/frontend/components/apply/EducationFields.tsx`
- Create: `apps/frontend/lib/apply/background-errors.ts`
- Test: `apps/frontend/lib/apply/background-errors.test.ts`
- Modify: `apps/frontend/components/apply/steps/BackgroundStep.tsx`

**Interfaces:**
- Produces:
  - `useFieldErrors(): { errors: Record<string,string>; setErrors: Dispatch<SetStateAction<Record<string,string>>>; clearErrors: (fields: string[]) => void }`
  - `<WorkHistoryFields form update errors setErrors clearErrors />` — years-of-experience card + under-minimum warning + `workExperiencesCurrent` banner + company boxes + "Add another company".
  - `<EducationFields form update errors clearErrors />` — education header, cards, "Add another qualification".
  - `backgroundErrors(form: Pick<WizardFormState,'yearsOfExperience'|'workExperiences'|'educations'>): Record<string,string>` — the work + education part of today's `validate()` (everything except peer references).

- [ ] **Step 1: Failing test for `backgroundErrors`**

```ts
// apps/frontend/lib/apply/background-errors.test.ts
import { describe, expect, it } from 'vitest';
import { backgroundErrors } from './background-errors';

const role = { title: 'Partner', company: 'Firm', companyUrl: 'https://firm.example', firmSize: '2_10' as const, startYear: 2020, isCurrent: true };

describe('backgroundErrors', () => {
  it('passes a complete background', () => {
    expect(backgroundErrors({ yearsOfExperience: '12', workExperiences: [role], educations: [{ institution: 'Uni', degree: 'LLB' }] })).toEqual({});
  });
  it('flags missing years, title and degree', () => {
    const e = backgroundErrors({
      yearsOfExperience: '',
      workExperiences: [{ ...role, title: '' }],
      educations: [{ institution: 'Uni', degree: '' }],
    });
    expect(e.yearsOfExperience).toBeDefined();
    expect(e['workExperiences.0.title']).toBeDefined();
    expect(e['educations.0.degree']).toBeDefined();
  });
  it('requires a current position', () => {
    expect(
      backgroundErrors({ yearsOfExperience: '12', workExperiences: [{ ...role, isCurrent: false, endYear: 2024 }], educations: [{ institution: 'Uni', degree: 'LLB' }] })
        .workExperiencesCurrent
    ).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — FAIL.** `pnpm --filter ./apps/frontend exec vitest run lib/apply/background-errors.test.ts`

- [ ] **Step 3: Extract, moving code verbatim**

1. `useFieldErrors.ts` — move `const [errors, setErrors] = useState(...)` and the `clearErrors` function out of `BackgroundStep` into a hook returning `{ errors, setErrors, clearErrors }` (`'use client'` not needed for a hook file; it's only imported by client components).
2. `lib/apply/background-errors.ts` — move from `BackgroundStep.validate()` everything **except** the peer-reference loop, plus the helpers it needs (`groupByCompany`, `isCurrentCompany`, `companyValue`, the `dateErrors` computation via `isEndBeforeStart`). Signature as in Interfaces; it calls `shareCompanyWebsites(form.workExperiences)` and `groupByCompany` itself. Export `groupByCompany` too (the component needs it). Keep message copy identical.
3. `WorkHistoryFields.tsx` — move JSX from the `WORK EXPERIENCE` header (`<div className="mt-7 flex items-baseline …">`) through the "+ Add another company" button, together with `updateWork`, `updateCompany`, `addRoleAt`, `removeRoles`, `isCurrentCompany`, `companyValue`, `dateWarnings`, `dateErrors`, `MIN_YEARS_OF_EXPERIENCE`, `WORK_EXPERIENCES_MAX`, `YEARS`. Props: `{ form: WizardFormState; update: (patch: Partial<WizardFormState>) => void; errors: Record<string,string>; setErrors: Dispatch<SetStateAction<Record<string,string>>>; clearErrors: (fields: string[]) => void }`.
4. `EducationFields.tsx` — move the `EDUCATION & QUALIFICATIONS` header through "+ Add another qualification", with `updateEdu` and `EDUCATIONS_MAX`. Props: `{ form; update; errors; clearErrors }`.
5. `BackgroundStep.tsx` keeps: heading/lede, both `useEffect`s (newest-first sort, `careerYears` auto-fill), peer references section + `updateReference`, `handleNext`, `StepActions`. Its `validate()` becomes `{ ...backgroundErrors(form), ...peerReferenceErrors }` (peer loop stays inline). Render `<WorkHistoryFields …/>` then `<EducationFields …/>` where the moved JSX was. `handleNext` still needs `companies` — get it from `groupByCompany(shareCompanyWebsites(form.workExperiences))`.

- [ ] **Step 4: Run all frontend tests + typecheck + lint — PASS.**

Run: `pnpm --filter ./apps/frontend exec vitest run && pnpm --filter ./apps/frontend typecheck && pnpm --filter ./apps/frontend lint`

Then open `/apply` locally (step "Your background") at 375 px and 1440 px and confirm it looks and behaves exactly as before: add/remove a company and a role, mark current, invalid dates warn, Next validates.

- [ ] **Step 5: Commit** — `refactor(apply): extract work-history and education fields for reuse`

---

### Task 7: Compute the overrides from an edited form

**Files:**
- Create: `apps/frontend/lib/admin/profile-overrides.ts`
- Test: `apps/frontend/lib/admin/profile-overrides.test.ts`

**Interfaces:**
- Consumes: `fromDto`, `toUpdateRequest`, `INITIAL_WIZARD_STATE` (`components/apply/types.ts`); `ApplicationProfileOverrides` (Task 4).
- Produces:
  - `formFromApplication(app: ApplicationDto): WizardFormState` = `{ ...INITIAL_WIZARD_STATE, ...fromDto(app), importedFields: new Set() }`
  - `profileOverrides(original: ApplicationDto, edited: WizardFormState): ApplicationProfileOverrides` — only keys whose value differs from the original.
  - `OVERRIDE_KEYS: readonly (keyof ApplicationProfileOverrides)[]`

- [ ] **Step 1: Failing test**

```ts
// apps/frontend/lib/admin/profile-overrides.test.ts
import { describe, expect, it } from 'vitest';
import type { ApplicationDto } from '@shared/membership-application';
import { formFromApplication, profileOverrides } from './profile-overrides';

const app = {
  firstName: 'Alex', lastName: 'Morgan', contactEmail: 'a@x.co', workEmail: 'old@w.co',
  phoneCountryCode: '+91', phone: '98765', region: 'south_asia', country: 'India', state: 'KA', city: 'Blr',
  linkedinUrl: null, bio: 'Bio', yearsOfExperience: 10, rateMinCents: 2000, rateMaxCents: 10000,
  workExperiences: [{ title: 'Partner', company: 'Firm', startYear: 2020, isCurrent: true }],
  educations: [{ institution: 'Uni', degree: 'LLB' }],
  peerReferences: [], servicePreferences: [], billingPeriod: 'annual', couponCode: null,
  linkedinImportConsent: false, photoUrl: null,
} as unknown as ApplicationDto;

describe('profileOverrides', () => {
  it('is empty when nothing changed', () => {
    expect(profileOverrides(app, formFromApplication(app))).toEqual({});
  });
  it('returns only the changed fields, in API units', () => {
    const form = { ...formFromApplication(app), workEmail: 'new@w.co', yearsOfExperience: '14', rateMaxDollars: '150' };
    expect(profileOverrides(app, form)).toEqual({ workEmail: 'new@w.co', yearsOfExperience: 14, rateMaxCents: 15000 });
  });
  it('sends the whole array when one education changes', () => {
    const form = formFromApplication(app);
    const edited = { ...form, educations: [{ institution: 'NLSIU', degree: 'LLM' }] };
    expect(profileOverrides(app, edited)).toEqual({ educations: [{ institution: 'NLSIU', degree: 'LLM' }] });
  });
});
```

- [ ] **Step 2: Run — FAIL.** `pnpm --filter ./apps/frontend exec vitest run lib/admin/profile-overrides.test.ts`

- [ ] **Step 3: Implement**

```ts
// apps/frontend/lib/admin/profile-overrides.ts
import type { ApplicationDto, ApplicationProfileOverrides } from '@shared/membership-application';
import { INITIAL_WIZARD_STATE, fromDto, toUpdateRequest, type WizardFormState } from '@/components/apply/types';

export const OVERRIDE_KEYS = [
  'firstName', 'lastName', 'contactEmail', 'workEmail', 'phoneCountryCode', 'phone', 'region', 'country',
  'state', 'city', 'linkedinUrl', 'bio', 'yearsOfExperience', 'rateMinCents', 'rateMaxCents',
  'workExperiences', 'educations',
] as const satisfies readonly (keyof ApplicationProfileOverrides)[];

/** The application as an editable form — same state shape (and field components) as the wizard. */
export function formFromApplication(app: ApplicationDto): WizardFormState {
  return { ...INITIAL_WIZARD_STATE, ...fromDto(app), importedFields: new Set<string>() };
}

/**
 * Only what the admin changed, compared through the wizard's own form → request mapping on both
 * sides so formatting differences (cents vs dollars, blank template rows) never count as edits.
 * Clearing a field isn't expressible (the mapping turns '' into "omitted"), so it isn't sent.
 */
export function profileOverrides(original: ApplicationDto, edited: WizardFormState): ApplicationProfileOverrides {
  const before = toUpdateRequest(formFromApplication(original));
  const after = toUpdateRequest(edited);
  const out: Record<string, unknown> = {};
  for (const key of OVERRIDE_KEYS) {
    if (after[key] !== undefined && JSON.stringify(after[key]) !== JSON.stringify(before[key])) out[key] = after[key];
  }
  return out as ApplicationProfileOverrides;
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit** — `feat(admin-ui): compute profile overrides from the edited form`

---

### Task 8: Review page — edit mode and any-service picker

**Files:**
- Create: `apps/frontend/components/admin/ApplicationProfileEditor.tsx`
- Create: `apps/frontend/components/admin/ApprovedServicePicker.tsx`
- Modify: `apps/frontend/components/admin/ApplicationReviewDetail.tsx`
- Modify: `apps/frontend/app/(shell)/admin/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `formFromApplication`, `profileOverrides` (Task 7); `WorkHistoryFields`, `EducationFields`, `useFieldErrors`, `backgroundErrors` (Task 6); `LocationFields`, `PHONE_COUNTRY_CODES`, `REGIONS` (`components/apply/*`); `rateErrors` (`lib/apply/rate-errors`); `EMAIL_PATTERN` (`lib/apply/save-errors`); `Combobox`, `ComboboxOption` (`components/ui/Combobox`); `servicePath`, `serviceLabel` (Task 5); `getCategoriesServer` (`lib/api/server`).
- Produces: `<ApplicationProfileEditor form update errors setErrors clearErrors />`; `<ApprovedServicePicker preferences categories value onChange />`; `ApplicationReviewDetail` gains prop `categories: CategoryDto[]`.

- [ ] **Step 1: Page passes the taxonomy**

```tsx
  const [application, categories] = await Promise.all([
    getAdminApplicationServer(params.id),
    getCategoriesServer(),
  ]);
  if (!application) {
    notFound();
  }
  …
          <ApplicationReviewDetail application={application} categories={categories} />
```

- [ ] **Step 2: `ApprovedServicePicker`**

```tsx
'use client';

import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import type { ServicePreference } from '@shared/membership-application';
import type { CategoryDto } from '@shared/category';
import { serviceLabel, servicePath } from '@/lib/applications/service-path';

const PRIORITY: Record<1 | 2 | 3, string> = { 1: '1st preference', 2: '2nd preference', 3: '3rd preference' };

/** Any active, non-custom service; the applicant's own preferences listed first. */
export function ApprovedServicePicker({
  preferences,
  categories,
  value,
  onChange,
}: {
  preferences: ServicePreference[];
  categories: CategoryDto[];
  value: string;
  onChange: (serviceId: string) => void;
}) {
  const preferred = new Set(preferences.map((p) => p.serviceId));
  const options: ComboboxOption[] = [
    ...[...preferences]
      .sort((a, b) => a.priority - b.priority)
      .map((p) => ({ value: p.serviceId, label: serviceLabel(p), context: `${PRIORITY[p.priority]} · ${servicePath(p)}` })),
    ...categories.flatMap((c) =>
      c.services
        .filter((s) => !s.isCustom && !preferred.has(s.id))
        .map((s) => ({ value: s.id, label: s.name, context: `${c.serviceLineName} › ${c.name}` }))
    ),
  ];
  return (
    <Combobox
      id="approvedServiceId"
      label="Approve for service"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Choose a service"
      searchPlaceholder="Search any service"
      emptyText="No service matches"
    />
  );
}
```

Check `Combobox`'s required props in `components/ui/Combobox.tsx:23-50` and adjust names if they differ.

- [ ] **Step 3: `ApplicationProfileEditor`** — sections, each a `Card` with a mono-label header, using `components/ui` `Input`/`Select`/`Textarea`:
  - **Contact:** First name, Last name (2-col ≥640 px, 1-col below), Contact email, Work email, phone = `Select` of `PHONE_COUNTRY_CODES` (value `code`, label `${country} (${code})`) + `Input` number, LinkedIn URL.
  - **Location:** `<LocationFields form={form} update={update} />` plus a `Select` for region from `REGIONS`.
  - **Bio:** `Textarea` (maxLength 2000).
  - **Rates:** two dollar `Input`s (`rateMinDollars`, `rateMaxDollars`), errors from `rateErrors`.
  - **Background:** `<WorkHistoryFields …/>` and `<EducationFields …/>`.
  Field ids match the error keys so `errors[...]` lines up. All props come from the parent; this component holds no state.

- [ ] **Step 4: Wire into `ApplicationReviewDetail`**
  - State: `const [editing, setEditing] = useState(false); const [form, setForm] = useState(() => formFromApplication(application)); const { errors, setErrors, clearErrors } = useFieldErrors();` and `update = (patch) => setForm((f) => ({ ...f, ...patch }))`.
  - `const overrides = profileOverrides(application, form); const editedCount = Object.keys(overrides).length;`
  - Above the left column (only when `isReviewable`): a bar with "Edit details" / "Done editing" `Button` (variant secondary), and when `editedCount > 0` a `Badge` "N fields corrected" plus a "Discard corrections" text button (`setForm(formFromApplication(application)); setErrors({})`). Copy under it: "Corrections apply to the member profile only; the application stays as submitted."
  - Left column: `editing ? <ApplicationProfileEditor …/> : <existing read-only rows>`. When not editing but corrected, the read-only rows show the corrected value: render them from `{ ...application, ...overrides }` — `rateMinCents/rateMaxCents` and arrays already in API shape — so the admin sees what will be approved; pass the original `application` as `previous` to the existing `ReviewRow`/`ReviewListRow` so every corrected field shows the old value struck through (the component already supports this).
  - Replace the "Approve for service" `<Select>` with `<ApprovedServicePicker preferences={application.servicePreferences} categories={categories} value={approvedServiceId} onChange={setApprovedServiceId} />`.
  - Tier default: when `overrides.yearsOfExperience` changes and the admin hasn't touched the tier select, set the tier to `yearsOfExperience > 12 ? 'seasoned_professional' : 'budding_entrepreneur'` (track `tierTouched` state; mirrors backend `computeTier`).
  - `approve()`: first `const fieldErrors = { ...backgroundErrors(form), ...rateErrors(form.rateMinDollars, form.rateMaxDollars) }` plus email checks with `EMAIL_PATTERN` for `contactEmail`/`workEmail`; if any, `setErrors`, `setEditing(true)`, show "Fix the highlighted fields before approving." and stop. Then send `{ status: 'approved', approvedServiceId, memberTier, membershipStartedAt, ...(editedCount ? { profileOverrides: overrides } : {}) }`.
  - `reject()` unchanged (never sends overrides).
  - Map new API errors in the shown message: `INVALID_RATE_RANGE` → "The maximum rate must be greater than the minimum." (check how `apiErrorMessage` maps codes — add to its map if it's code-keyed).

- [ ] **Step 5: Typecheck, lint, tests.** `pnpm --filter ./apps/frontend typecheck && pnpm --filter ./apps/frontend lint && pnpm --filter ./apps/frontend exec vitest run`

- [ ] **Step 6: Commit** — `feat(admin-ui): correct applicant details and approve for any service`

---

### Task 9: End-to-end check and verify

- [ ] **Step 1:** Run backend + frontend dev servers **from this worktree** (ask the user first if ports 3000/4000 are in use by another checkout). As an admin, open a submitted application in dev:
  - Preferences show "Tax › … · 1st preference"; the list table shows the service-line › category column.
  - Edit details → change work email, years (tier follows), one education, rate max; "N fields corrected" shows; Done editing shows old values struck through.
  - Picker: search for a service that's not a preference, pick it.
  - Approve. Then check (psql read of only these rows, or the member's profile page): member profile has the corrected email/years/education/rate and the picked service with no custom label; the `membership_applications` row still has the original values.
  - A rejection with edits made: rejects fine, edits not sent.
- [ ] **Step 2:** Same page at 375 px and 1440 px (headless Chrome screenshots per `reference_headless_browser_check`): editor stacks to one column, picker usable, no horizontal scroll.
- [ ] **Step 3:** `pnpm verify` from the worktree root — must pass.
- [ ] **Step 4:** Update the spec's "Frontend" section if implementation differed (e.g. per-section vs per-field markers), commit `docs: align spec with implementation`.
- [ ] **Step 5:** Report to the user: files changed, US-08-01 criteria met, Postman/docs/shared-types updated, nothing pushed.
