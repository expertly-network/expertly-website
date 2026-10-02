# Consultations Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-up users (client or member role) a working `POST /v1/consultations` to request
time with a member, with members able to see/act on requests sent to them
(`GET/PATCH /v1/consultations/received`, `/:id`), requesters able to track what they've sent
(`GET /v1/consultations/mine`), and admins full oversight (`/v1/admin/consultations`) — rate-limited
per requester. No frontend in this plan.

**Architecture:** New `ConsultationsModule` (`apps/backend/src/consultations/`) following the
`EventsModule`/`MembersModule` repository→service→controller split exactly.
`ConsultationsRepository` is the only Supabase consumer; `ConsultationsService` holds ownership
checks, the rate-limit window, and cross-profile enrichment (batched `profiles`/`member_profiles`
lookups, same pattern `MembersRepository.findProfilesByIds` already uses); two thin controllers
(`ConsultationsController` for the owner-facing routes, `AdminConsultationsController` for
`manageConsultations`-gated oversight).

**Tech Stack:** NestJS (Fastify), class-validator, Supabase (service-role client, `@supabase/
supabase-js` via `SupabaseService`).

**Spec:** `docs/superpowers/specs/2026-10-01-consultations-backend-design.md`

**No test runner exists in this repo** (`apps/backend` has no `.spec.ts`/jest config — confirmed
by search before writing this plan). Every task below verifies with `pnpm typecheck` plus a
concrete manual check (curl command with expected output) instead of an automated test step —
this matches root `CLAUDE.md` / `apps/backend/CLAUDE.md`'s prescribed verification method, not a
TDD cycle.

## Global Constraints

- Base path `/v1`. Backend port `4000` (`apps/backend/.env`'s `PORT`).
- `apps/backend/src/supabase/database.types.ts` is **generated, never hand-edited**
  (`pnpm gen:types`, needs `SUPABASE_DB_URL`) — the spec's §5 said "hand-update," which is wrong;
  this plan corrects it. Task 2 regenerates it for real.
- Repository is the only Supabase consumer per module; every query names its columns via a
  `const X_COLUMNS = [...] as const` paired with a hand-written row `interface`; never `select('*')`
  or bare `select()` (`apps/backend/CLAUDE.md`).
- `service_id`, `custom_service_label`, `subject`, `description`, `scheduled_at`,
  `response_message` on `consultation_requests` are **not** read or written anywhere in this plan
  — no UI for them exists yet (spec §3).
- Rate limit: env vars `CONSULTATION_REQUEST_LIMIT` (default `3`) and
  `CONSULTATION_REQUEST_WINDOW_DAYS` (default `1`), fixed windows anchored to 08:00 UTC against
  epoch `1970-01-01T08:00:00Z` (spec §4) — not a rolling window, not per-target-member.
- No error-code scheme — plain NestJS `HttpException` subclasses with descriptive messages,
  matching every other module in this backend (spec §7).

---

## Backend phase

### Task 1: Shared types

**Files:**
- Create: `packages/shared-types/consultation-request.ts`
- Modify: `packages/shared-types/index.ts`

**Interfaces:**
- Produces: `ConsultationStatus`, `ConsultationRequestDto`, `CreateConsultationRequestRequest`,
  `UpdateConsultationStatusRequest` — imported by every later backend task via `@shared/
  consultation-request`.

- [ ] **Step 1: Write `packages/shared-types/consultation-request.ts`**

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ConsultationStatus = 'pending' | 'completed' | 'declined';

// Matches supabase/migrations/0004_tables.sql's `consultation_requests` table, enriched with
// display fields resolved server-side from `profiles`/`member_profiles` — never trusted from
// client input. `serviceId`/`customServiceLabel`/`subject`/`description`/`scheduledAt`/
// `responseMessage` are schema columns with no UI in the current design prototype and are
// deliberately not exposed here — see
// docs/superpowers/specs/2026-10-01-consultations-backend-design.md §3.
export class ConsultationRequestDto {
  @ApiProperty() id!: string;
  @ApiProperty() requesterId!: string;
  @ApiProperty() requesterName!: string;
  @ApiProperty() requesterContactEmail!: string;
  @ApiProperty() requesterPhone!: string;
  @ApiProperty() memberId!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: ['pending', 'completed', 'declined'] }) status!: ConsultationStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  // Populated on GET /consultations/mine — who the request went to. Undefined on
  // GET /consultations/received (the viewer already knows — it's themselves) and on the raw
  // POST /consultations response.
  @ApiPropertyOptional({ nullable: true, type: String }) memberFirmName?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberHeadline?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberAvatarUrl?: string | null;
  // Populated on GET /consultations/received only — whether the requester is themselves a
  // verified member (peer-to-peer request), computed server-side from profiles.role, never from
  // client input.
  @ApiPropertyOptional() requesterIsVerifiedMember?: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) requesterFirmName?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) requesterAvatarUrl?: string | null;
}

export class CreateConsultationRequestRequest {
  @ApiProperty() memberId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() message!: string;
}

export class UpdateConsultationStatusRequest {
  @ApiProperty({ enum: ['completed', 'declined'] }) status!: 'completed' | 'declined';
}
```

- [ ] **Step 2: Export it from the index**

In `packages/shared-types/index.ts`, add this line after the `event` line:

```ts
export type * from './consultation-request';
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/backend && pnpm typecheck && cd ../frontend && pnpm typecheck`
Expected: both pass (this file is consumed by both apps via the `@shared/*` alias; nothing
references it yet, so this just confirms the file itself compiles).

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/consultation-request.ts packages/shared-types/index.ts
git commit -m "feat(shared-types): add ConsultationRequestDto and request/response types"
```

---

### Task 2: Schema migration + regenerated types

**Files:**
- Modify: `supabase/migrations/0004_tables.sql`
- Modify: `apps/backend/src/supabase/database.types.ts` (regenerated, not hand-edited)

- [ ] **Step 1: Add the three new columns**

In `supabase/migrations/0004_tables.sql`, find this exact text (the `consultation_requests` table
definition):

```sql
create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
```

Replace with:

```sql
create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  -- Collected directly on the request form, independent of the requester's account profile
  -- (profiles.email/phone) — the prototype's modal lets them type different contact details here.
  requester_name text not null,
  requester_contact_email text not null,
  requester_phone text not null,
  service_id uuid references public.services (id) on delete set null,
```

- [ ] **Step 2: Apply the migration to your dev Supabase database**

Pre-production convention: this is folded into the canonical `0004_tables.sql`, not a new
numbered file (`supabase/migrations/README.md`). Apply it the way this project already applies
schema changes — paste the updated `consultation_requests` table definition (or the whole file, if
rebuilding from scratch) into the Supabase SQL Editor for your dev project, or `supabase db push`
if you've adopted the CLI.

If you don't have dev-database access in your current environment, stop here and hand this step to
someone who does before continuing — Task 4 needs the regenerated types below to typecheck, and
Task 8's curl verification needs the live columns to exist.

- [ ] **Step 3: Regenerate `database.types.ts`**

Run (needs `SUPABASE_DB_URL` set — see `apps/backend/.env`):

```bash
cd apps/backend && pnpm gen:types
```

Expected: `src/supabase/database.types.ts`'s `consultation_requests` entry now includes
`requester_name: string`, `requester_contact_email: string`, `requester_phone: string` in `Row`
and `Insert` (required, no `?` — matches the `not null` columns), and `requester_name?: string`
etc. in `Update`. **Never hand-edit this file** — if `gen:types` isn't runnable here, this task
isn't done; don't substitute a manual edit (`apps/backend/CLAUDE.md`).

- [ ] **Step 4: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass (nothing references the new columns yet, this just confirms the regenerated file
itself is valid TypeScript).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_tables.sql apps/backend/src/supabase/database.types.ts
git commit -m "feat(db): add requester contact columns to consultation_requests"
```

---

### Task 3: Backend DTOs

**Files:**
- Create: `apps/backend/src/consultations/dto/create-consultation-request.dto.ts`
- Create: `apps/backend/src/consultations/dto/update-consultation-status.dto.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CreateConsultationRequestDto`, `UpdateConsultationStatusDto` — consumed by Task 5
  (service) and Task 6 (controllers).

- [ ] **Step 1: Write `create-consultation-request.dto.ts`**

```ts
import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateConsultationRequestDto {
  @IsUUID()
  memberId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
```

- [ ] **Step 2: Write `update-consultation-status.dto.ts`**

```ts
import { IsIn } from 'class-validator';

export class UpdateConsultationStatusDto {
  @IsIn(['completed', 'declined'])
  status!: 'completed' | 'declined';
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/consultations/dto/
git commit -m "feat(consultations): add request DTOs"
```

---

### Task 4: `ConsultationsRepository`

**Files:**
- Create: `apps/backend/src/consultations/consultations.repository.ts`

**Interfaces:**
- Consumes: `Database` type from `../supabase/database.types` (Task 2), `ConsultationRequestDto`
  from `@shared/consultation-request` (Task 1).
- Produces: `ConsultationsRepository` with methods `findProfileRole(id): Promise<ProfileRoleRow |
  null>`, `countByRequesterSince(requesterId, sinceIso): Promise<number>`,
  `insert(row): Promise<ConsultationRequestDto>`, `findByRequesterId(requesterId):
  Promise<ConsultationRequestDto[]>`, `findByMemberId(memberId): Promise<ConsultationRequestDto[]>`,
  `findAll(): Promise<ConsultationRequestDto[]>`, `findById(id): Promise<ConsultationRequestDto>`
  (throws `NotFoundException` if missing), `updateStatus(id, status): Promise<ConsultationRequestDto>`,
  `findProfilesByIds(ids): Promise<Map<string, ProfileIdentityRow>>`,
  `findMemberFirmsByProfileIds(ids): Promise<Map<string, MemberFirmRow>>` — all consumed by Task 5
  (service).

- [ ] **Step 1: Write the repository**

```ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { ConsultationRequestDto } from '@shared/consultation-request';

export type ConsultationRequestInsert = Database['public']['Tables']['consultation_requests']['Insert'];

// Every column aliased to its ConsultationRequestDto camelCase name. service_id/
// custom_service_label/subject/description/scheduled_at/response_message are deliberately
// excluded — unused by this feature, see the design spec §3.
const CONSULTATION_COLUMNS = [
  'id',
  'requesterId:requester_id',
  'requesterName:requester_name',
  'requesterContactEmail:requester_contact_email',
  'requesterPhone:requester_phone',
  'memberId:member_id',
  'message',
  'status',
  'createdAt:created_at',
  'updatedAt:updated_at',
] as const;

const PROFILE_ROLE_COLUMNS = ['id', 'role'] as const;
export interface ProfileRoleRow {
  id: string;
  role: 'client' | 'member' | 'admin';
}

const PROFILE_IDENTITY_COLUMNS = ['id', 'avatarUrl:avatar_url', 'role'] as const;
export interface ProfileIdentityRow {
  id: string;
  avatarUrl: string | null;
  role: 'client' | 'member' | 'admin';
}

const MEMBER_FIRM_COLUMNS = ['profileId:profile_id', 'firmName:firm_name', 'headline'] as const;
export interface MemberFirmRow {
  profileId: string;
  firmName: string | null;
  headline: string | null;
}

@Injectable()
export class ConsultationsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private consultations() {
    return this.supabase.db.from('consultation_requests');
  }

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  async findProfileRole(id: string): Promise<ProfileRoleRow | null> {
    const { data, error } = await this.profiles()
      .select(PROFILE_ROLE_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to look up profile.');
    return data as unknown as ProfileRoleRow | null;
  }

  async countByRequesterSince(requesterId: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.consultations()
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', requesterId)
      .gte('created_at', sinceIso);

    if (error) throw new InternalServerErrorException('Failed to check consultation request rate limit.');
    return count ?? 0;
  }

  async insert(row: ConsultationRequestInsert): Promise<ConsultationRequestDto> {
    const { data: inserted, error } = await this.consultations()
      .insert(row)
      .select(CONSULTATION_COLUMNS.join(', '))
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create consultation request.');
    return inserted as unknown as ConsultationRequestDto;
  }

  async findByRequesterId(requesterId: string): Promise<ConsultationRequestDto[]> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .eq('requester_id', requesterId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load consultation requests.');
    return data as unknown as ConsultationRequestDto[];
  }

  async findByMemberId(memberId: string): Promise<ConsultationRequestDto[]> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load consultation requests.');
    return data as unknown as ConsultationRequestDto[];
  }

  async findAll(): Promise<ConsultationRequestDto[]> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load consultation requests.');
    return data as unknown as ConsultationRequestDto[];
  }

  async findById(id: string): Promise<ConsultationRequestDto> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load consultation request.');
    if (!data) throw new NotFoundException('Consultation request not found.');
    return data as unknown as ConsultationRequestDto;
  }

  async updateStatus(id: string, status: 'completed' | 'declined'): Promise<ConsultationRequestDto> {
    const { data: updated, error } = await this.consultations()
      .update({ status })
      .eq('id', id)
      .select(CONSULTATION_COLUMNS.join(', '))
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update consultation request.');
    return updated as unknown as ConsultationRequestDto;
  }

  async findProfilesByIds(ids: string[]): Promise<Map<string, ProfileIdentityRow>> {
    const map = new Map<string, ProfileIdentityRow>();
    if (ids.length === 0) return map;

    const { data, error } = await this.profiles().select(PROFILE_IDENTITY_COLUMNS.join(', ')).in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to load profile identities.');
    for (const p of (data ?? []) as unknown as ProfileIdentityRow[]) map.set(p.id, p);
    return map;
  }

  async findMemberFirmsByProfileIds(ids: string[]): Promise<Map<string, MemberFirmRow>> {
    const map = new Map<string, MemberFirmRow>();
    if (ids.length === 0) return map;

    const { data, error } = await this.memberProfiles().select(MEMBER_FIRM_COLUMNS.join(', ')).in('profile_id', ids);
    if (error) throw new InternalServerErrorException('Failed to load member profiles.');
    for (const m of (data ?? []) as unknown as MemberFirmRow[]) map.set(m.profileId, m);
    return map;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass. If it fails on `requester_name`/`requester_contact_email`/`requester_phone` not
existing on the `Insert` type, Task 2's `gen:types` run didn't pick up the migration — go back and
confirm the migration was actually applied to the DB `gen:types` pointed at.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/consultations/consultations.repository.ts
git commit -m "feat(consultations): add ConsultationsRepository"
```

---

### Task 5: `ConsultationsService`

**Files:**
- Create: `apps/backend/src/consultations/consultations.service.ts`

**Interfaces:**
- Consumes: `ConsultationsRepository` (Task 4), `CreateConsultationRequestDto`/
  `UpdateConsultationStatusDto` (Task 3), `AuthenticatedUser` (`{ id, email, role, firstName,
  lastName }`, from `../auth/types/auth.types`), `ConsultationRequestDto` (Task 1).
- Produces: `ConsultationsService` with methods `create(requester, dto)`, `findMine(requesterId)`,
  `findReceived(member)`, `updateStatus(id, member, dto)`, `adminList()`,
  `adminUpdateStatus(id, dto)` — consumed by Task 6 (controllers).

- [ ] **Step 1: Write the service**

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ConsultationRequestDto } from '@shared/consultation-request';
import { ConsultationsRepository } from './consultations.repository';
import { CreateConsultationRequestDto } from './dto/create-consultation-request.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';

const DEFAULT_LIMIT = 3;
const DEFAULT_WINDOW_DAYS = 1;
const WINDOW_EPOCH_MS = Date.parse('1970-01-01T08:00:00.000Z');

@Injectable()
export class ConsultationsService {
  constructor(private readonly repository: ConsultationsRepository) {}

  private rateLimit(): number {
    const parsed = Number(process.env.CONSULTATION_REQUEST_LIMIT);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT;
  }

  private windowDays(): number {
    const parsed = Number(process.env.CONSULTATION_REQUEST_WINDOW_DAYS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_DAYS;
  }

  // Fixed-size windows of `windowDays` days, anchored to 08:00 UTC against a fixed epoch — not a
  // rolling clock. See docs/superpowers/specs/2026-10-01-consultations-backend-design.md §4.
  private currentWindow(): { startIso: string; resetAt: string } {
    const windowMs = this.windowDays() * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const elapsed = now - WINDOW_EPOCH_MS;
    const windowStart = WINDOW_EPOCH_MS + Math.floor(elapsed / windowMs) * windowMs;
    return {
      startIso: new Date(windowStart).toISOString(),
      resetAt: new Date(windowStart + windowMs).toISOString(),
    };
  }

  async create(requester: AuthenticatedUser, dto: CreateConsultationRequestDto): Promise<ConsultationRequestDto> {
    if (dto.memberId === requester.id) {
      throw new BadRequestException('You cannot request a consultation with yourself.');
    }

    const target = await this.repository.findProfileRole(dto.memberId);
    if (!target || target.role !== 'member') {
      throw new BadRequestException('No such member.');
    }

    const { startIso, resetAt } = this.currentWindow();
    const count = await this.repository.countByRequesterSince(requester.id, startIso);
    if (count >= this.rateLimit()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many consultation requests — try again later.',
          resetAt,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return this.repository.insert({
      requester_id: requester.id,
      member_id: dto.memberId,
      requester_name: dto.name,
      requester_contact_email: dto.email,
      requester_phone: dto.phone,
      message: dto.message,
    });
  }

  async findMine(requesterId: string): Promise<ConsultationRequestDto[]> {
    const requests = await this.repository.findByRequesterId(requesterId);
    return this.enrichWithMemberInfo(requests);
  }

  async findReceived(member: AuthenticatedUser): Promise<ConsultationRequestDto[]> {
    if (member.role !== 'member') {
      throw new ForbiddenException('Only members receive consultation requests.');
    }
    const requests = await this.repository.findByMemberId(member.id);
    return this.enrichWithRequesterInfo(requests);
  }

  async updateStatus(
    id: string,
    member: AuthenticatedUser,
    dto: UpdateConsultationStatusDto
  ): Promise<ConsultationRequestDto> {
    const existing = await this.repository.findById(id);
    if (existing.memberId !== member.id) {
      throw new ForbiddenException('You can only update your own consultation requests.');
    }
    if (existing.status !== 'pending') {
      throw new ConflictException('This consultation request has already been decided.');
    }
    return this.repository.updateStatus(id, dto.status);
  }

  async adminList(): Promise<ConsultationRequestDto[]> {
    return this.repository.findAll();
  }

  async adminUpdateStatus(id: string, dto: UpdateConsultationStatusDto): Promise<ConsultationRequestDto> {
    const existing = await this.repository.findById(id);
    if (existing.status !== 'pending') {
      throw new ConflictException('This consultation request has already been decided.');
    }
    return this.repository.updateStatus(id, dto.status);
  }

  private async enrichWithMemberInfo(requests: ConsultationRequestDto[]): Promise<ConsultationRequestDto[]> {
    const memberIds = [...new Set(requests.map((r) => r.memberId))];
    const [profiles, firms] = await Promise.all([
      this.repository.findProfilesByIds(memberIds),
      this.repository.findMemberFirmsByProfileIds(memberIds),
    ]);
    return requests.map((r) => {
      const profile = profiles.get(r.memberId);
      const firm = firms.get(r.memberId);
      return {
        ...r,
        memberFirmName: firm?.firmName ?? null,
        memberHeadline: firm?.headline ?? null,
        memberAvatarUrl: profile?.avatarUrl ?? null,
      };
    });
  }

  private async enrichWithRequesterInfo(requests: ConsultationRequestDto[]): Promise<ConsultationRequestDto[]> {
    const requesterIds = [...new Set(requests.map((r) => r.requesterId))];
    const [profiles, firms] = await Promise.all([
      this.repository.findProfilesByIds(requesterIds),
      this.repository.findMemberFirmsByProfileIds(requesterIds),
    ]);
    return requests.map((r) => {
      const profile = profiles.get(r.requesterId);
      const isMember = profile?.role === 'member';
      const firm = isMember ? firms.get(r.requesterId) : undefined;
      return {
        ...r,
        requesterIsVerifiedMember: isMember ?? false,
        requesterFirmName: firm?.firmName ?? null,
        requesterAvatarUrl: profile?.avatarUrl ?? null,
      };
    });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/consultations/consultations.service.ts
git commit -m "feat(consultations): add ConsultationsService"
```

---

### Task 6: Controllers + module wiring

**Files:**
- Create: `apps/backend/src/consultations/consultations.controller.ts`
- Create: `apps/backend/src/consultations/admin-consultations.controller.ts`
- Create: `apps/backend/src/consultations/consultations.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Write `consultations.controller.ts`**

```ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ConsultationRequestDto } from '@shared/consultation-request';
import { ConsultationsService } from './consultations.service';
import { CreateConsultationRequestDto } from './dto/create-consultation-request.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';

// 🔑 Auth on create; 🔒 Owner on the rest — ownership/role checks live in ConsultationsService,
// not here.
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConsultationRequestDto
  ): Promise<ConsultationRequestDto> {
    return this.service.create(user, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ConsultationRequestDto[]> {
    return this.service.findMine(user.id);
  }

  @Get('received')
  findReceived(@CurrentUser() user: AuthenticatedUser): Promise<ConsultationRequestDto[]> {
    return this.service.findReceived(user);
  }

  @Patch(':id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateConsultationStatusDto
  ): Promise<ConsultationRequestDto> {
    return this.service.updateStatus(id, user, dto);
  }
}
```

- [ ] **Step 2: Write `admin-consultations.controller.ts`**

```ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { ConsultationRequestDto } from '@shared/consultation-request';
import { ConsultationsService } from './consultations.service';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';

// 🛡️ manageConsultations on every route here — same posture as AdminEventsController/
// AdminMembersController.
@Roles('admin')
@RequiresPermission('manageConsultations')
@Controller('admin')
export class AdminConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Get('consultations')
  list(): Promise<ConsultationRequestDto[]> {
    return this.service.adminList();
  }

  @Patch('consultations/:id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsultationStatusDto
  ): Promise<ConsultationRequestDto> {
    return this.service.adminUpdateStatus(id, dto);
  }
}
```

- [ ] **Step 3: Write `consultations.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsultationsController } from './consultations.controller';
import { AdminConsultationsController } from './admin-consultations.controller';
import { ConsultationsService } from './consultations.service';
import { ConsultationsRepository } from './consultations.repository';

@Module({
  imports: [AuthModule],
  controllers: [ConsultationsController, AdminConsultationsController],
  providers: [ConsultationsService, ConsultationsRepository],
})
export class ConsultationsModule {}
```

- [ ] **Step 4: Register the module**

In `apps/backend/src/app.module.ts`, add the import line after the `EventsModule` import:

```ts
import { ConsultationsModule } from './consultations/consultations.module';
```

And add `ConsultationsModule` to the `imports` array, after `EventsModule`:

```ts
  imports: [
    AuthModule,
    CategoriesModule,
    ServicesModule,
    ApplicationsModule,
    MembersModule,
    EventsModule,
    ConsultationsModule,
    ArticlesModule,
  ],
```

- [ ] **Step 5: Typecheck and build**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/consultations/consultations.controller.ts apps/backend/src/consultations/admin-consultations.controller.ts apps/backend/src/consultations/consultations.module.ts apps/backend/src/app.module.ts
git commit -m "feat(consultations): wire up ConsultationsModule at /v1/consultations and /v1/admin/consultations"
```

---

### Task 7: Update docs (contract is now fixed)

**Files:**
- Modify: `docs/rest-api.md`
- Modify: `docs/database-erd.md`
- Modify: `docs/user-stories.md`
- Modify: `docs/master-tdd.md`

- [ ] **Step 1: `docs/rest-api.md`** — append a new `## Consultations` section at the end of the
file (after the existing `## Member directory & profiles — not built yet` section, which is
currently the last thing in the file):

```markdown

## Consultations

One resource, `consultation_requests` — a client or member requesting time with a member. No
topic/service picker, no time-slot scheduling, no rate/payment (per `docs/roadmap.md`'s read of
the prototype — not added without a product decision). Contact always resolves to `mailto:`/`tel:`,
no in-app messaging.

### 🔑 `POST /v1/consultations`

Creates a request. Any authenticated role (`client` or `member`) may send one, including to a
member who is themselves a signed-up member (peer-to-peer) — the prototype's own creation flow
never actually restricts this despite its inbox view implying a client/member distinction.

Rate-limited: `CONSULTATION_REQUEST_LIMIT` (default `3`) requests per
`CONSULTATION_REQUEST_WINDOW_DAYS`-day (default `1`) window, counted across all target members, not
per-member. Windows are fixed-size blocks anchored to 08:00 UTC, not a rolling clock — see
`docs/superpowers/specs/2026-10-01-consultations-backend-design.md` §4 for the exact math.

**Request:** `CreateConsultationRequestRequest`. **Response `201`:** `ConsultationRequestDto`.
**Errors:** `401` no/invalid token · `400` validation failure, `memberId` isn't a `member`-role
profile, or `memberId === caller.id` · `429` rate limit exceeded (body includes `resetAt`, the ISO
timestamp the window next resets).

### 🔒 `GET /v1/consultations/mine`

The caller's own sent requests, newest first, enriched with `memberFirmName`/`memberHeadline`/
`memberAvatarUrl` (the member they sent each request to).

**Response `200`:** `ConsultationRequestDto[]`.

### 🔒 `GET /v1/consultations/received`

The caller's received requests, newest first — scoped to `member_id = caller.id`. **The design
prototype (`consultation-requests.html`) has no such filter at all** (shows every request to every
member); this is deliberately not reproduced. Each row is enriched with `requesterIsVerifiedMember`
(computed from `profiles.role`, never client input), `requesterFirmName`, `requesterAvatarUrl`.

**Response `200`:** `ConsultationRequestDto[]`. **Errors:** `403` caller's role isn't `member`.

### 🔒 `PATCH /v1/consultations/:id`

Owner (the target member) transitions `pending` → `completed`/`declined`. No intermediate state,
no cancel, no re-opening a decided request.

**Request:** `UpdateConsultationStatusRequest`. **Response `200`:** `ConsultationRequestDto`.
**Errors:** `401` · `403` caller isn't the request's `memberId` · `404` not found · `409` already
decided.

### 🛡️ `manageConsultations` `GET /v1/admin/consultations`

Every request regardless of status or member, newest first, unpaginated (same posture as
`AdminMembersController.listMembers()`).

**Response `200`:** `ConsultationRequestDto[]`.

### 🛡️ `manageConsultations` `PATCH /v1/admin/consultations/:id`

Same transition as the owner-member route, no ownership check.

**Request:** `UpdateConsultationStatusRequest`. **Response `200`:** `ConsultationRequestDto`.
**Errors:** `401` · `403` · `404` not found · `409` already decided.

### Not built yet (explicitly deferred)

- `serviceId`/`customServiceLabel`/`subject`/`description`/`scheduledAt`/`responseMessage` — schema
  columns, no UI in the current design prototype to collect or display them.
- The "Schedule a Call" tab in `member-profile.html`'s request modal — Peer Connect-shaped
  scheduling (VC link, AI transcription), out of scope; see `docs/roadmap.md`'s Peer Connect
  section.
- Notifications (new request received, request completed/declined) — no notification
  infrastructure exists yet (`docs/master-tdd.md` Section 8.3).
- Frontend — the request modal, the member's received-requests inbox, and the requester's
  sent-requests page are not built. See `docs/user-stories.md`'s US-11.
```

- [ ] **Step 2: `docs/database-erd.md`** — append a new `## Consultations` section at the end of
the file (after the current last line, `itself still deferred (see that section above).`):

```markdown

## Consultations (`supabase/migrations/0004_tables.sql`)

### `consultation_requests`

Created ahead of any API work in the initial schema migration (see the "live database vs.
migration file drift" note above) — this session adds the real contract on top of it.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `requester_id` | `uuid not null` | FK → `profiles.id`, cascade delete |
| `member_id` | `uuid not null` | FK → `profiles.id`, cascade delete |
| `requester_name` | `text not null` | **New.** Collected on the request form — independent of the requester's account profile, since the prototype's modal lets the value differ from it |
| `requester_contact_email` | `text not null` | **New.** Same reasoning — distinct from `profiles.email` |
| `requester_phone` | `text not null` | **New.** Distinct from `profiles.phone` |
| `service_id` | `uuid` | FK → `services.id`, set null on delete. **Unused** — no topic picker in the request-creation modal |
| `custom_service_label` | `text` | **Unused**, same reason |
| `subject` | `text` | **Unused**, same reason |
| `message` | `text not null` | The "Description of Work Required" field |
| `description` | `text` | **Unused** |
| `status` | `consultation_status enum` | `'pending' \| 'completed' \| 'declined'`, default `'pending'` |
| `scheduled_at` | `timestamptz` | **Unused** — no scheduling in this feature (see Peer Connect) |
| `response_message` | `text` | **Unused** — no response-note field in the prototype's complete/decline actions |
| `created_at` / `updated_at` | `timestamptz not null` | — |

### Design decisions

- **Three new `not null` text columns** (`requester_name`/`requester_contact_email`/
  `requester_phone`) added this session — the original schema-only table had no way to store the
  contact details the request-creation modal actually collects, which are independent of the
  requester's account profile (`profiles.email`/`profiles.phone`). No backfill needed
  (pre-production, zero rows existed).
- **Six columns left unused** (`service_id`, `custom_service_label`, `subject`, `description`,
  `scheduled_at`, `response_message`) — present in the schema-only table ahead of any product
  decision; no corresponding field exists anywhere in `consultation-requests.html`,
  `my-consultations.html`, or the request modal in `member-profile.html`. Left in place (harmless,
  nullable) rather than dropped, in case a future product decision adds a topic picker or
  scheduling — not wired up speculatively now.
- **`GET /v1/consultations/received` is scoped to `member_id = caller.id`** — the prototype's own
  `consultation-requests.html` has no ownership filter at all (every member sees every request in
  the shared `admin-data.js` store); the real backend does not reproduce that.
- **No rate-limit table/column** — the `CONSULTATION_REQUEST_LIMIT`/`CONSULTATION_REQUEST_WINDOW_DAYS`
  window is computed at request time from `consultation_requests.created_at`, no extra schema
  needed. See `docs/rest-api.md`'s Consultations section.

### Not built yet (explicitly deferred)

- Everything under the six unused columns above.
- Peer Connect-style "Schedule a Call" scheduling — separate feature, own session.
```

- [ ] **Step 3: `docs/user-stories.md`** — find this exact text:

```
## US-11 — Requesting a Consultation 🧱

### US-11-01: Sending a consultation request
As a client (or another member), I want to request time with a member so I can get expert advice.
- [ ] `POST /v1/consultations` 🔑 — collects name, email, phone, message only; no topic picker, no
      time-slot scheduling, no rate/payment (per `docs/roadmap.md`, don't add these without a
      product decision)
- [ ] Resolves to `mailto:`/`tel:` contact, not in-app messaging

### US-11-02: Managing consultation requests I've received
As a member, I want to see requests sent to me (not everyone's requests) and mark each completed
or declined.
- [ ] `GET /v1/consultations/received` scoped to `memberId === caller.id` — the design prototype
      has no such filter; the real backend must add it, not reproduce the prototype's
      show-everything behavior
- [ ] `PATCH /v1/consultations/:id` 🔒 owner-member or admin only; states are `pending` →
      `completed`/`declined`, no intermediate state, no cancel

### US-11-03: Tracking requests I've sent
As a client or member, I want to see the status of consultation requests I've sent.
- [ ] `GET /v1/consultations/mine` 🔒 owner (the requester)
```

Replace with:

```
## US-11 — Requesting a Consultation ⚠️ Backend built, frontend not

### US-11-01: Sending a consultation request
As a client (or another member), I want to request time with a member so I can get expert advice.
- [x] `POST /v1/consultations` 🔑 — collects name, email, phone, message only; no topic picker, no
      time-slot scheduling, no rate/payment (per `docs/roadmap.md`, don't add these without a
      product decision)
- [x] Rate-limited: `CONSULTATION_REQUEST_LIMIT` requests per `CONSULTATION_REQUEST_WINDOW_DAYS`-
      day window (defaults 3/1), `429` once exceeded — new requirement, not in the original
      prototype/roadmap sketch. See `docs/rest-api.md`'s Consultations section.
- [ ] Resolves to `mailto:`/`tel:` contact, not in-app messaging — frontend not built yet
- Not built: the request modal itself (`member-profile.html`'s "Send a Message" panel) — separate
  frontend session

### US-11-02: Managing consultation requests I've received
As a member, I want to see requests sent to me (not everyone's requests) and mark each completed
or declined.
- [x] `GET /v1/consultations/received` scoped to `memberId === caller.id` — the design prototype
      has no such filter; the real backend adds it rather than reproducing the prototype's
      show-everything behavior
- [x] `PATCH /v1/consultations/:id` 🔒 owner-member or admin only; states are `pending` →
      `completed`/`declined`, no intermediate state, no cancel
- Not built: the inbox page itself (`consultation-requests.html`) — separate frontend session

### US-11-03: Tracking requests I've sent
As a client or member, I want to see the status of consultation requests I've sent.
- [x] `GET /v1/consultations/mine` 🔒 owner (the requester)
- Not built: the sent-requests page itself (`my-consultations.html`) — separate frontend session
```

- [ ] **Step 4: `docs/master-tdd.md`** — four separate edits.

Find:
```
| `consultation_requests` | 🧱 Schema only | none — see Section 6 |
```
Replace:
```
| `consultation_requests` | ⚠️ Backend built, frontend not | `consultations/` |
```

Find:
```
Note: `manageEvents` is now wired up (`AdminEventsController`, see Section 6). `manageConsultations`
and `manageResources` still have no backend module to gate — the permission model was scoped ahead
of the features it'll gate.
```
Replace:
```
Note: `manageEvents` and `manageConsultations` are now wired up (`AdminEventsController`,
`AdminConsultationsController`, see Section 6). `manageResources` still has no backend module to
gate — the permission model was scoped ahead of the features it'll gate.
```

Find:
```
| Consultations | 🧱 Schema only | `consultation-requests.html`, `my-consultations.html` | Sketch endpoints in `docs/roadmap.md` |
```
Replace:
```
| Consultations | ⚠️ Backend built (create/mine/received/status transitions + admin oversight, rate-limited), frontend not | `consultation-requests.html`, `my-consultations.html` | See `docs/rest-api.md`'s Consultations section; request modal, inbox, and my-consultations pages not built yet |
```

Find:
```
| Consultations (new session) | `docs/roadmap.md` §Consultations, Section 6 | US-11 |
```
Replace:
```
| Consultations frontend (new session) | `docs/rest-api.md`, `docs/database-erd.md`, Section 6 | US-11 |
```

Find:
```
2. **Consultations** — schema exists, simple CRUD, no unresolved dependency once member profiles
   exist (needs a valid `memberId`).
```
Replace:
```
2. **Consultations** — backend built (create/mine/received/status transitions + admin oversight,
   rate-limited per requester). Frontend (request modal, member inbox, requester's sent-list page)
   remains — its own session, per root `CLAUDE.md`'s backend/frontend split.
```

- [ ] **Step 5: Commit**

```bash
git add docs/rest-api.md docs/database-erd.md docs/user-stories.md docs/master-tdd.md
git commit -m "docs: document consultations backend contract"
```

---

### Task 8: Backend manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend**

Run: `cd apps/backend && pnpm dev`
Expected: server starts on port 4000 with no errors, `ConsultationsModule` logs both controllers
registered.

- [ ] **Step 2: Get three bearer tokens**

Via Supabase or existing test accounts per `docs/auth.md` — one each for a `client`, a `member`
(call them `$MEMBER_TOKEN`, note their profile id as `$MEMBER_ID`), and an `admin`
(`$ADMIN_TOKEN`). Also note a second member's id as `$OTHER_MEMBER_ID` if available, for the
cross-member ownership check in Step 6.

- [ ] **Step 3: Verify auth boundary**

```bash
# No token — expect 401
curl -i http://localhost:4000/v1/consultations/mine

# Client token, self-request — expect 400
curl -i -X POST http://localhost:4000/v1/consultations \
  -H "Authorization: Bearer $CLIENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"memberId\":\"$CLIENT_ID\",\"name\":\"Test\",\"email\":\"test@example.com\",\"phone\":\"+1 555 0100\",\"message\":\"Need help.\"}"
```

- [ ] **Step 4: Create a request, verify it appears in `mine` and `received`**

```bash
curl -i -X POST http://localhost:4000/v1/consultations \
  -H "Authorization: Bearer $CLIENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"memberId\":\"$MEMBER_ID\",\"name\":\"Amelia Ross\",\"email\":\"amelia@firm.com\",\"phone\":\"+1 212 555 0148\",\"message\":\"Need advice on transfer pricing.\"}"
# Expected: 201, status "pending", requesterName/requesterContactEmail/requesterPhone echo the body

curl -s http://localhost:4000/v1/consultations/mine -H "Authorization: Bearer $CLIENT_TOKEN" | grep "Amelia Ross"
# Expected: present

curl -s http://localhost:4000/v1/consultations/received -H "Authorization: Bearer $MEMBER_TOKEN" | grep "Amelia Ross"
# Expected: present

# A client calling /received — expect 403
curl -i http://localhost:4000/v1/consultations/received -H "Authorization: Bearer $CLIENT_TOKEN"
```

- [ ] **Step 5: Verify the rate limit**

With `CONSULTATION_REQUEST_LIMIT` at its default (3), repeat Step 4's `POST` two more times (3
total), then a 4th:

```bash
# 4th request from the same client in the same window — expect 429 with a resetAt field
curl -i -X POST http://localhost:4000/v1/consultations \
  -H "Authorization: Bearer $CLIENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"memberId\":\"$MEMBER_ID\",\"name\":\"Amelia Ross\",\"email\":\"amelia@firm.com\",\"phone\":\"+1 212 555 0148\",\"message\":\"One more.\"}"
```

- [ ] **Step 6: Verify status transitions and ownership**

Using the id from Step 4's first created request (`$REQUEST_ID`):

```bash
# Wrong member tries to complete it — expect 403 (skip if you don't have a second member token)
curl -i -X PATCH http://localhost:4000/v1/consultations/$REQUEST_ID \
  -H "Authorization: Bearer $OTHER_MEMBER_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed"}'

# Correct member completes it — expect 200, status "completed"
curl -i -X PATCH http://localhost:4000/v1/consultations/$REQUEST_ID \
  -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed"}'

# Same request again — expect 409, already decided
curl -i -X PATCH http://localhost:4000/v1/consultations/$REQUEST_ID \
  -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"declined"}'
```

- [ ] **Step 7: Verify admin oversight**

```bash
# Member token on the admin route — expect 403
curl -i http://localhost:4000/v1/admin/consultations -H "Authorization: Bearer $MEMBER_TOKEN"

# Admin token — expect 200 with every request across every member
curl -i http://localhost:4000/v1/admin/consultations -H "Authorization: Bearer $ADMIN_TOKEN"
```

- [ ] **Step 8: Check Swagger reflects the new routes**

Visit `http://localhost:4000/api` in a browser — confirm `/v1/consultations`,
`/v1/consultations/mine`, `/v1/consultations/received`, `/v1/consultations/{id}`,
`/v1/admin/consultations`, `/v1/admin/consultations/{id}` all appear with the right DTOs.
