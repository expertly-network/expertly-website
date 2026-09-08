# Admin Events CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins direct create/edit/delete control over events at `/admin/events`, backed by
new `GET/POST /v1/admin/events` + `GET/PATCH/DELETE /v1/admin/events/:id` endpoints — no public
suggestion queue in this pass (deferred, see the spec).

**Architecture:** New `AdminEventsController` (mirrors `AdminApplicationsController`) reusing the
existing `EventsService`, extended with admin methods. Frontend adds three routes under
`app/(shell)/admin/events/` and reuses `EventRow`'s layout (given an optional admin slot) instead
of forking a second row component.

**Tech Stack:** NestJS (Fastify), class-validator, Supabase (service-role client), Next.js App
Router (Server Components for data fetching, a client form/list for interactivity), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-events-crud-design.md`

**No test runner exists in this repo** (`apps/backend` has no `.spec.ts`/jest config,
`apps/frontend` has none either — confirmed by search before writing this plan). Every task below
verifies with `pnpm typecheck` plus a concrete manual check (curl command with expected output, or
a browser step) instead of an automated test step — this matches the verification method root
`CLAUDE.md` and `apps/frontend/CLAUDE.md` already prescribe for this codebase, not a TDD cycle.

---

## Backend phase

### Task 1: Shared request types

**Files:**
- Modify: `packages/shared-types/event.ts`

- [ ] **Step 1: Add `CreateEventRequest`/`UpdateEventRequest`**

Change the top import line and append these two exports at the end of the file:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
```

(replaces the current `import { ApiProperty } from '@nestjs/swagger';` line)

```ts
export class CreateEventRequest {
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() shortDescription?: string;
  @ApiPropertyOptional() coverImageUrl?: string;
  @ApiProperty() startDate!: string;
  @ApiPropertyOptional() endDate?: string;
  @ApiPropertyOptional() timezone?: string;
  @ApiPropertyOptional() eventType?: string;
  @ApiPropertyOptional({ enum: ['in_person', 'virtual', 'hybrid'] }) eventFormat?: EventFormat;
  @ApiPropertyOptional() country?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() venueName?: string;
  @ApiPropertyOptional() isFree?: boolean;
  @ApiPropertyOptional() registrationUrl?: string;
  @ApiPropertyOptional() organiserName?: string;
  /** Omit for `'draft'` — matches the `events.status` column's own default. The admin form
   * always sends an explicit draft-or-publish choice; this only matters as a safety net. */
  @ApiPropertyOptional({ enum: ['draft', 'published'] }) status?: EventStatus;
}

// All fields optional; only provided fields change.
export type UpdateEventRequest = Partial<CreateEventRequest>;
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/backend && pnpm typecheck && cd ../frontend && pnpm typecheck`
Expected: both pass (this file is consumed by both apps via the `@shared/*` alias).

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/event.ts
git commit -m "feat(shared-types): add CreateEventRequest/UpdateEventRequest"
```

---

### Task 2: Backend DTOs

**Files:**
- Create: `apps/backend/src/events/dto/create-event.dto.ts`
- Create: `apps/backend/src/events/dto/update-event.dto.ts`

- [ ] **Step 1: Write `create-event.dto.ts`**

```ts
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import type { EventFormat, EventStatus } from '@shared/event';

const EVENT_FORMATS: EventFormat[] = ['in_person', 'virtual', 'hybrid'];
const EVENT_STATUSES: EventStatus[] = ['draft', 'published'];

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  eventFormat?: EventFormat;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsUrl()
  registrationUrl?: string;

  @IsOptional()
  @IsString()
  organiserName?: string;

  // Defaults to 'draft' in EventsService.create if omitted — see CreateEventRequest's comment.
  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: EventStatus;
}
```

- [ ] **Step 2: Write `update-event.dto.ts`**

```ts
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import type { EventFormat, EventStatus } from '@shared/event';

const EVENT_FORMATS: EventFormat[] = ['in_person', 'virtual', 'hybrid'];
const EVENT_STATUSES: EventStatus[] = ['draft', 'published'];

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsIn(EVENT_FORMATS)
  eventFormat?: EventFormat;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsUrl()
  registrationUrl?: string;

  @IsOptional()
  @IsString()
  organiserName?: string;

  @IsOptional()
  @IsIn(EVENT_STATUSES)
  status?: EventStatus;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/events/dto
git commit -m "feat(events): add admin create/update DTOs"
```

---

### Task 3: `EventsService` admin methods

**Files:**
- Modify: `apps/backend/src/events/events.service.ts`

- [ ] **Step 1: Update imports and add admin methods**

Replace the top of the file (the import block plus `SELECT_COLUMNS`) — currently:

```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { EventDto } from '@shared/event';

const SELECT_COLUMNS =
  'id, title, slug, description, shortDescription:short_description, coverImageUrl:cover_image_url, ' +
  'startDate:start_date, endDate:end_date, timezone, eventType:event_type, eventFormat:event_format, ' +
  'country, city, venueName:venue_name, isFree:is_free, registrationUrl:registration_url, ' +
  'organiserName:organiser_name, status, createdAt:created_at, updatedAt:updated_at';
```

with:

```ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { EventDto } from '@shared/event';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const SELECT_COLUMNS =
  'id, title, slug, description, shortDescription:short_description, coverImageUrl:cover_image_url, ' +
  'startDate:start_date, endDate:end_date, timezone, eventType:event_type, eventFormat:event_format, ' +
  'country, city, venueName:venue_name, isFree:is_free, registrationUrl:registration_url, ' +
  'organiserName:organiser_name, status, createdAt:created_at, updatedAt:updated_at';
```

Then, inside the `EventsService` class, add these methods immediately after `listAll()` (i.e.
right before the class's closing `}`):

```ts
  // Every event regardless of status, ordered the same way the public browse list is
  // (chronological by start_date) — backs the admin list at /admin/events, which needs to show
  // drafts too, unlike listAll() above.
  async adminList(): Promise<EventDto[]> {
    const { data, error } = await this.supabase.db
      .from('events')
      .select(SELECT_COLUMNS)
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  // Single event, any status — backs the admin edit page's prefill. No public equivalent exists:
  // GET /v1/events never needed a by-id shape.
  async adminGetOne(id: string): Promise<EventDto> {
    const { data, error } = await this.supabase.db
      .from('events')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load event.');
    if (!data) throw new NotFoundException('Event not found.');
    return data as unknown as EventDto;
  }

  async create(dto: CreateEventDto): Promise<EventDto> {
    const slug = await this.generateUniqueSlug(dto.title);

    const { data: inserted, error } = await this.supabase.db
      .from('events')
      .insert({
        slug,
        title: dto.title,
        description: dto.description,
        short_description: dto.shortDescription ?? null,
        cover_image_url: dto.coverImageUrl ?? null,
        start_date: dto.startDate,
        end_date: dto.endDate ?? null,
        timezone: dto.timezone ?? null,
        event_type: dto.eventType ?? null,
        event_format: dto.eventFormat ?? null,
        country: dto.country ?? null,
        city: dto.city ?? null,
        venue_name: dto.venueName ?? null,
        is_free: dto.isFree ?? false,
        registration_url: dto.registrationUrl ?? null,
        organiser_name: dto.organiserName ?? null,
        // Matches the column's own default — see CreateEventDto.status's comment.
        status: dto.status ?? 'draft',
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create event.');
    return inserted as unknown as EventDto;
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDto> {
    await this.adminGetOne(id); // 404s if missing before attempting the patch

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.shortDescription !== undefined) patch.short_description = dto.shortDescription;
    if (dto.coverImageUrl !== undefined) patch.cover_image_url = dto.coverImageUrl;
    if (dto.startDate !== undefined) patch.start_date = dto.startDate;
    if (dto.endDate !== undefined) patch.end_date = dto.endDate;
    if (dto.timezone !== undefined) patch.timezone = dto.timezone;
    if (dto.eventType !== undefined) patch.event_type = dto.eventType;
    if (dto.eventFormat !== undefined) patch.event_format = dto.eventFormat;
    if (dto.country !== undefined) patch.country = dto.country;
    if (dto.city !== undefined) patch.city = dto.city;
    if (dto.venueName !== undefined) patch.venue_name = dto.venueName;
    if (dto.isFree !== undefined) patch.is_free = dto.isFree;
    if (dto.registrationUrl !== undefined) patch.registration_url = dto.registrationUrl;
    if (dto.organiserName !== undefined) patch.organiser_name = dto.organiserName;
    if (dto.status !== undefined) patch.status = dto.status;

    const { data: updated, error } = await this.supabase.db
      .from('events')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLUMNS)
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update event.');
    return updated as unknown as EventDto;
  }

  async remove(id: string): Promise<void> {
    await this.adminGetOne(id); // 404s if missing before attempting the delete

    const { error } = await this.supabase.db.from('events').delete().eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to delete event.');
  }

  // Same shape as ArticlesService.generateUniqueSlug: lowercase/hyphenate the title, then
  // disambiguate against the table's real unique constraint by appending -2, -3, ... rather
  // than trusting an in-memory check for a race-free guarantee. Own copy (not shared with
  // ArticlesService) since it targets a different table — matches this codebase's existing
  // convention of not having a shared slug util.
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    for (let suffix = 2; ; suffix++) {
      const { data, error } = await this.supabase.db
        .from('events')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();

      if (error) throw new InternalServerErrorException('Failed to generate event slug.');
      if (!data) return candidate;
      candidate = `${base}-${suffix}`;
    }
  }
```

Finally, add this function at the bottom of the file, outside the class:

```ts

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'event';
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass. (`CreateEventDto`/`UpdateEventDto` imports will error until Task 2 is done —
confirm Task 2 landed first.)

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/events/events.service.ts
git commit -m "feat(events): add admin list/get/create/update/delete to EventsService"
```

---

### Task 4: `AdminEventsController` + module wiring

**Files:**
- Create: `apps/backend/src/events/admin-events.controller.ts`
- Modify: `apps/backend/src/events/events.module.ts`

- [ ] **Step 1: Write the controller**

```ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
// Real (not `import type`) import — Swagger's @ApiResponse needs the actual class at runtime,
// same as ArticlesController/AdminApplicationsController.
import { EventDto } from '@shared/event';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

// 🛡️ manageEvents — @Roles('admin') for the base role (freshly re-checked by RolesGuard),
// @RequiresPermission('manageEvents') to further narrow to admins whose admin_role actually
// carries it (freshly re-checked by AdminPermissionGuard). Same pattern as
// AdminApplicationsController / AdminMembersController. Direct CRUD only — no suggestion-queue
// endpoints here, see docs/superpowers/specs/2026-09-08-admin-events-crud-design.md.
@Roles('admin')
@RequiresPermission('manageEvents')
@Controller('admin')
export class AdminEventsController {
  constructor(private readonly service: EventsService) {}

  @Get('events')
  list(): Promise<EventDto[]> {
    return this.service.adminList();
  }

  @Get('events/:id')
  findOne(@Param('id') id: string): Promise<EventDto> {
    return this.service.adminGetOne(id);
  }

  @Post('events')
  create(@Body() dto: CreateEventDto): Promise<EventDto> {
    return this.service.create(dto);
  }

  @Patch('events/:id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto): Promise<EventDto> {
    return this.service.update(id, dto);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
```

- [ ] **Step 2: Register the controller**

Replace `apps/backend/src/events/events.module.ts` entirely with:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { AdminEventsController } from './admin-events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
```

- [ ] **Step 3: Typecheck and build**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/events/admin-events.controller.ts apps/backend/src/events/events.module.ts
git commit -m "feat(events): add AdminEventsController at /v1/admin/events"
```

---

### Task 5: Update docs (contract is now fixed)

**Files:**
- Modify: `docs/rest-api.md`
- Modify: `docs/database-erd.md`
- Modify: `docs/user-stories.md`
- Modify: `docs/master-tdd.md`

- [ ] **Step 1: `docs/rest-api.md`** — in the `## Events` section, insert a new `## Events — admin`
section between the existing `### 🌐 GET /v1/events` block and `### Not built yet`, and rewrite
that `### Not built yet` block. Find this exact text:

```
**Response `200`:** `EventDto[]`.

### Not built yet (explicitly deferred)

- Public suggestion queue + admin moderation (`draft`→`published`/rejected) — `status` already
  supports this (`event_status` enum), but no write endpoints exist yet. All seeded rows are
  inserted directly as `published`. The `/events` page's "Suggest an event" card is a `mailto:`
  link, not a form, since there's nowhere to submit one yet.
- Country/format/date-range filtering on `GET /v1/events` itself — the standalone page filters
  client-side over the full `upcoming=false` set (same pattern as `/articles`), not query params,
  since the dataset is small (dozens, not thousands).
```

Replace it with:

```
**Response `200`:** `EventDto[]`.

## Events — admin

🛡️ `manageEvents` on every route below — same posture as Membership applications admin: base
`admin` role re-checked fresh (`RolesGuard`), then `admin_role` re-checked fresh against the
`manageEvents` permission (`AdminPermissionGuard`). Direct admin CRUD only — no public
suggestion-queue submission endpoint exists yet (see "Not built yet" below).

### 🛡️ `manageEvents` `GET /v1/admin/events`

Every event regardless of `status` (draft and published), chronological by `start_date` — same
ordering as the public browse list, just not status-filtered. Backs the admin list at
`/admin/events`.

**Response `200`:** `EventDto[]`.

### 🛡️ `manageEvents` `GET /v1/admin/events/:id`

Single event, any status. Backs the admin edit page's prefill — no public by-id endpoint exists
to reuse (the public route only ever needed list shapes).

**Response `200`:** `EventDto`. **Errors:** `404` not found.

### 🛡️ `manageEvents` `POST /v1/admin/events`

Creates an event. Slug is generated server-side from `title` (never client-writable, same
posture as article slugs).

**Request:** `CreateEventRequest`. `status` optional — **omitting it defaults to `'draft'`**,
matching the `events.status` column's own default; the admin form always sends an explicit
draft-or-publish choice, so this only matters as a safety net.

**Response `201`:** `EventDto`. **Errors:** `401` no/invalid token · `403` not admin or missing
`manageEvents` · `400` validation failure.

### 🛡️ `manageEvents` `PATCH /v1/admin/events/:id`

Partial update — only provided fields change, including `status` (draft ⇄ published).

**Request:** `UpdateEventRequest`. **Response `200`:** `EventDto`. **Errors:** `401` · `403` ·
`404` not found · `400` validation failure.

### 🛡️ `manageEvents` `DELETE /v1/admin/events/:id`

**Response `204`.** **Errors:** `401` · `403` · `404` not found.

### Not built yet (explicitly deferred)

- Public suggestion queue + admin approve/reject moderation of those suggestions
  (`POST /v1/events/suggestions`, admin review endpoints) — `status` already supports the
  underlying state, but no submission endpoint exists yet. The `/events` page's "Suggest an
  event" card remains a `mailto:` link. Direct admin add/edit/delete (above) is built; the
  public-submission half of US-13-01 is not.
- Country/format/date-range filtering on `GET /v1/events` itself — the standalone page filters
  client-side over the full `upcoming=false` set (same pattern as `/articles`), not query params,
  since the dataset is small (dozens, not thousands).
```

- [ ] **Step 2: `docs/database-erd.md`** — find this exact text in the `## Events` section:

```
**Only `GET /v1/events` (upcoming + published) is built.** No write/suggestion/admin-moderation
endpoints exist yet — `status` already models the moderation state a future session needs, so no
schema change should be required when that session ships. See `docs/rest-api.md`'s Events
section for the exact current contract.
```

Replace with:

```
**`GET /v1/events` (public, published-only) plus direct admin CRUD (`GET`/`POST /v1/admin/events`,
`GET`/`PATCH`/`DELETE /v1/admin/events/:id`) are built.** The public suggestion-queue submission
endpoint is not — `status` already models the moderation state that future session needs, so no
schema change should be required when it ships. See `docs/rest-api.md`'s Events section for the
exact current contract.
```

- [ ] **Step 3: `docs/user-stories.md`** — find this exact text:

```
## US-13 — Events ⚠️ Browsing built, suggestion queue not

### US-13-01: Suggesting an event
As a client or member, I want to suggest an event for the community calendar.
- [ ] Suggestion enters a `pending` queue; admin approves (publishes) or rejects/deletes
- [ ] Admin can also directly add-and-publish, bypassing the queue — one soft-hide list, not two
      disconnected pools (don't reproduce that prototype shortcut)
- Not built: `/events`'s "Suggest an event" card is a `mailto:contact@expertly.global` link, not
  a form — there's nowhere to submit a suggestion to yet.
```

Replace with:

```
## US-13 — Events ⚠️ Browsing + direct admin CRUD built, suggestion queue not

### US-13-01: Suggesting an event
As a client or member, I want to suggest an event for the community calendar.
- [ ] Suggestion enters a `pending` queue; admin approves (publishes) or rejects/deletes
- [x] Admin can also directly add-and-publish, bypassing the queue — one soft-hide list, not two
      disconnected pools (don't reproduce that prototype shortcut). Built as `/admin/events`:
      create, edit (including draft ⇄ published), and delete — see `docs/rest-api.md`'s
      Events — admin section.
- Not built: `/events`'s "Suggest an event" card is a `mailto:contact@expertly.global` link, not
  a form — there's nowhere to submit a suggestion to yet. The public submission → pending-queue
  half of this story remains deferred.
```

- [ ] **Step 4: `docs/master-tdd.md`** — four separate edits.

Find:
```
| `events` | ⚠️ Partially built — `GET /v1/events` only (upcoming + published, homepage use only), no write/moderation endpoints | `events/` |
```
Replace:
```
| `events` | ⚠️ Partially built — public `GET /v1/events` plus admin CRUD (`/v1/admin/events`); public suggestion-queue submission not built | `events/` |
```

Find:
```
Note: `manageEvents`, `manageConsultations`, and `manageResources` permissions already exist in
that constant even though events/consultations/perks-templates-learnings have no backend module
yet — the permission model was scoped ahead of the features it'll gate.
```
Replace:
```
Note: `manageEvents` is now wired up (`AdminEventsController`, see Section 6). `manageConsultations`
and `manageResources` still have no backend module to gate — the permission model was scoped ahead
of the features it'll gate.
```

Find:
```
| Events | ✅ Built — homepage teaser + standalone `/events` browse page | `events.html` | `GET /v1/events?upcoming=false` backs the standalone page's month-grouped, client-filtered list (date preset/country/format); no suggestion-queue write endpoint or admin moderation yet — "Suggest an event" is a `mailto:` link. See `docs/rest-api.md` |
```
Replace:
```
| Events | ✅ Built — homepage teaser, standalone `/events` browse page, admin CRUD at `/admin/events` | `events.html` | `GET /v1/events?upcoming=false` backs the standalone page's month-grouped, client-filtered list (date preset/country/format); `/admin/events` covers direct create/edit/delete. No public suggestion-queue submission endpoint yet — "Suggest an event" is a `mailto:` link. See `docs/rest-api.md` |
```

Find:
```
4. **Events** — schema exists; medium complexity (suggestion queue + admin moderation).
```
Replace:
```
4. **Events** — direct admin CRUD built; remaining scope is just the public suggestion-queue
   submission + approval flow, lower complexity than the original estimate.
```

- [ ] **Step 5: Commit**

```bash
git add docs/rest-api.md docs/database-erd.md docs/user-stories.md docs/master-tdd.md
git commit -m "docs: document admin events CRUD contract"
```

---

### Task 6: Backend manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend**

Run: `cd apps/backend && pnpm dev`
Expected: server starts on its configured port with no errors, `EventsModule` logs both
controllers registered.

- [ ] **Step 2: Verify auth boundary with curl**

Get three bearer tokens first (client, member, admin — via Supabase or existing test accounts per
`docs/auth.md`), then:

```bash
# No token — expect 401
curl -i http://localhost:3001/v1/admin/events

# Client or member token — expect 403 (RolesGuard rejects non-admin)
curl -i http://localhost:3001/v1/admin/events -H "Authorization: Bearer $MEMBER_TOKEN"

# Admin token — expect 200 with an array (possibly empty)
curl -i http://localhost:3001/v1/admin/events -H "Authorization: Bearer $ADMIN_TOKEN"
```

- [ ] **Step 3: Verify create defaults to draft**

```bash
curl -i -X POST http://localhost:3001/v1/admin/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Event","description":"A test.","startDate":"2027-01-15"}'
```
Expected: `201`, response body has `"status":"draft"` and a generated `"slug"`.

- [ ] **Step 4: Verify the public endpoint still excludes it**

```bash
curl -s http://localhost:3001/v1/events?upcoming=false | grep "Test Event"
```
Expected: no output — the draft event must not appear on the public route.

- [ ] **Step 5: Verify publish via PATCH, then delete**

```bash
# Replace :id with the id from Step 3's response
curl -i -X PATCH http://localhost:3001/v1/admin/events/:id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"published"}'
# Expected: 200, "status":"published"

curl -s http://localhost:3001/v1/events?upcoming=false | grep "Test Event"
# Expected: now appears

curl -i -X DELETE http://localhost:3001/v1/admin/events/:id \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 204

curl -i http://localhost:3001/v1/admin/events/:id -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 404
```

No commit for this task — verification only, confirms Tasks 1–4 work end-to-end before the
frontend phase starts against this contract.

---

## Frontend phase

### Task 7: `lib/api/events.ts` client mutations

**Files:**
- Create: `apps/frontend/lib/api/events.ts`

- [ ] **Step 1: Write the file**

```ts
import { apiFetch } from '@/lib/api/client';
import type { CreateEventRequest, EventDto, UpdateEventRequest } from '@shared/event';

export function createEvent(body: CreateEventRequest): Promise<EventDto> {
  return apiFetch<EventDto>('/admin/events', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateEvent(id: string, body: UpdateEventRequest): Promise<EventDto> {
  return apiFetch<EventDto>(`/admin/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteEvent(id: string): Promise<void> {
  return apiFetch<void>(`/admin/events/${id}`, {
    method: 'DELETE',
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/lib/api/events.ts
git commit -m "feat(frontend): add admin events API client"
```

---

### Task 8: `lib/api/server.ts` admin fetchers

**Files:**
- Modify: `apps/frontend/lib/api/server.ts`

- [ ] **Step 1: Append two functions** at the end of the file (after `getEventsServer`):

```ts

/**
 * Server Component variant for the admin events list (apps/frontend/app/(shell)/admin/events).
 * 🛡️ manageEvents on the backend — returns every event regardless of status, unlike the public
 * getEventsServer above. Empty array (not a throw) when there's no session, matching
 * getMyMemberEditsServer's convention — the page itself already redirects non-admins before this
 * is ever called with no session.
 */
export async function getAdminEventsServer(): Promise<EventDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`${getApiBaseUrlServer()}/v1/admin/events`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load events.', res.status);
  }

  return res.json();
}

/**
 * Server Component variant for the admin edit page's prefill (apps/frontend/app/(shell)/admin/
 * events/[id]/edit). Returns null on no-session or 404 — same convention as getMemberServer —
 * the page turns a null into notFound().
 */
export async function getAdminEventServer(id: string): Promise<EventDto | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${getApiBaseUrlServer()}/v1/admin/events/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load event.', res.status);
  }

  return res.json();
}
```

`EventDto` is already imported at the top of this file (used by `getEventsServer`) — no import
change needed.

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/lib/api/server.ts
git commit -m "feat(frontend): add admin events server fetchers"
```

---

### Task 9: `EventRow` admin slot

**Files:**
- Modify: `apps/frontend/components/events/EventRow.tsx`

- [ ] **Step 1: Replace the entire file** with:

```tsx
import type { ReactNode } from 'react';
import { Badge, Button } from '@/components/ui';
import type { EventDto } from '@shared/event';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });

const FORMAT_LABEL: Record<NonNullable<EventDto['eventFormat']>, string> = {
  in_person: 'In Person',
  hybrid: 'Hybrid',
  virtual: 'Virtual',
};

function formatDateRange(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  if (!endDate) return DATE_FORMAT.format(start);
  const end = new Date(endDate);
  if (start.toDateString() === end.toDateString()) return DATE_FORMAT.format(start);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(start)} ${start.getDate()}–${end.getDate()}`
    : `${DATE_FORMAT.format(start)} – ${DATE_FORMAT.format(end)}`;
}

// Matches design/static_html/events.html's `.ev-row` layout exactly — 140px date column, 36px
// column gap, 17px date/title text. `isMonthFirst` reproduces the design's `.ev-row.ev-month-
// first` treatment — the first event of each month group gets a tinted, border-free highlight
// instead of the plain divider row every other event uses.
//
// `adminBadge`/`adminActions` are optional slots the admin list (components/admin/
// AdminEventsList.tsx) uses to show a draft/published Badge and swap the public Register CTA for
// Edit/Delete actions — the public /events page passes neither and renders exactly as before.
export function EventRow({
  event,
  isMonthFirst = false,
  adminBadge,
  adminActions,
}: {
  event: EventDto;
  isMonthFirst?: boolean;
  adminBadge?: ReactNode;
  adminActions?: ReactNode;
}) {
  const location = [event.city, event.country].filter(Boolean).join(', ');

  const registerAction = event.registrationUrl ? (
    <Button href={event.registrationUrl} variant="secondary" size="sm" className="self-start">
      Register →
    </Button>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      disabled
      aria-disabled="true"
      title="Coming soon — registration isn't live yet"
      className="self-start"
    >
      Register →
    </Button>
  );

  return (
    <div
      className={
        isMonthFirst
          ? 'grid grid-cols-[140px_1fr_180px_auto] items-center gap-x-9 rounded-xl bg-[color-mix(in_oklab,var(--accent)_6%,var(--bg-card))] px-5 py-7 max-[900px]:grid-cols-1 max-[900px]:gap-y-3 max-[900px]:px-4'
          : 'grid grid-cols-[140px_1fr_180px_auto] items-center gap-x-9 border-b border-line py-7 max-[900px]:grid-cols-1 max-[900px]:gap-y-3'
      }
    >
      <div>
        <span className="mb-1 block font-mono text-[10px] tracking-[0.12em] text-ink-4">Date</span>
        <span className="text-[17px] font-medium leading-[1.2] tracking-[-0.02em] text-ink">
          {formatDateRange(event.startDate, event.endDate)}
        </span>
      </div>

      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {event.eventType && <Badge variant="neutral">{event.eventType}</Badge>}
          {event.eventFormat && (
            <Badge variant={event.eventFormat === 'in_person' ? 'neutral' : 'brand'}>
              {FORMAT_LABEL[event.eventFormat]}
            </Badge>
          )}
          {adminBadge}
        </div>
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-[1.25] tracking-[-0.018em] text-ink">
          {event.title}
        </h3>
        {/* `description` holds the seed's short one-line blurb (0006_dev_seed_events.sql) —
            `shortDescription` is a separate, currently-unpopulated column, not used here. */}
        {event.description && (
          <p className="mt-1 line-clamp-1 text-[13px] leading-[1.5] text-ink-3">{event.description}</p>
        )}
      </div>

      {location && (
        <div>
          <span className="mb-1 block font-mono text-[10px] tracking-[0.12em] text-ink-4">Location</span>
          <div className="text-[13px] font-medium text-ink-2">{event.city}</div>
          <div className="mt-0.5 font-mono text-[11px] tracking-[0.04em] text-ink-4">{event.country}</div>
        </div>
      )}

      {/* registrationUrl is unpopulated in seed data and there's no real registration/booking
          backend yet — same disabled-CTA treatment as MemberCard's Request Consultation button,
          not a fake external link, matching the design's own Register button (equally
          non-functional there: `onclick="event.preventDefault()"`). adminActions overrides this
          entirely in the admin list. */}
      {adminActions ?? registerAction}
    </div>
  );
}
```

The only real changes from the current file: the new `ReactNode` import, the two new optional
props, `adminBadge` rendered alongside the existing badges, and the trailing
`{adminActions ?? registerAction}` swap (previously an inline ternary). Public callers
(`EventsList.tsx`, `UpcomingEvents.tsx` if it uses `EventRow`) pass neither prop, so their output
is byte-for-byte unchanged.

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/events/EventRow.tsx
git commit -m "feat(events): give EventRow an optional admin badge/actions slot"
```

---

### Task 10: `AdminEventsList` component

**Files:**
- Create: `apps/frontend/components/admin/AdminEventsList.tsx`

- [ ] **Step 1: Write the file**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { EventRow } from '@/components/events/EventRow';
import { deleteEvent } from '@/lib/api/events';
import { ApiError } from '@/lib/api/client';
import type { EventDto, EventStatus } from '@shared/event';

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

const STATUS_BADGE_VARIANT: Record<EventStatus, 'neutral' | 'emphasis'> = {
  draft: 'neutral',
  published: 'emphasis',
};

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

// Inline expand-to-confirm delete, same UX as AdminApplicationsTable's reject flow — a plain
// confirm()/alert() would be inconsistent with how every other destructive admin action in this
// app already works.
function AdminEventActions({ event, onDeleted }: { event: EventDto; onDeleted: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setError(null);
    setBusy(true);
    try {
      await deleteEvent(event.id);
      onDeleted(event.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete this event.');
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 self-start">
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={confirmDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Confirm delete'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 self-start">
      <div className="flex gap-2">
        <Button href={`/admin/events/${event.id}/edit`} size="sm" variant="secondary">
          Edit
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// Same month-grouping presentation as the public EventsList, minus the date/country/format
// filters — the admin needs to see everything (including drafts), not a filtered subset.
// initialEvents is already ordered chronologically by the server (EventsService.adminList).
export function AdminEventsList({ initialEvents }: { initialEvents: EventDto[] }) {
  const [events, setEvents] = useState(initialEvents);

  function handleDeleted(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const groups = useMemo(() => {
    const map = new Map<string, EventDto[]>();
    for (const e of events) {
      const key = MONTH_FORMAT.format(new Date(e.startDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [events]);

  if (events.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-3">No events yet — create one to get started.</p>;
  }

  return (
    <div>
      {groups.map(([month, monthEvents], i) => (
        <div key={month} className={i === 0 ? '' : 'mt-[52px]'}>
          <div className="mb-[18px] flex items-baseline gap-3.5">
            <span className="flex-none text-[clamp(26px,3vw,36px)] font-medium tracking-[-0.03em] text-ink">
              {month}
            </span>
            {i > 0 && <span className="h-px flex-1 bg-line" />}
          </div>
          <div>
            {monthEvents.map((event, j) => (
              <EventRow
                key={event.id}
                event={event}
                isMonthFirst={j === 0}
                adminBadge={
                  <Badge variant={STATUS_BADGE_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                }
                adminActions={<AdminEventActions event={event} onDeleted={handleDeleted} />}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/admin/AdminEventsList.tsx
git commit -m "feat(admin): add AdminEventsList with inline delete-confirm"
```

---

### Task 11: `EventForm` component (create + edit)

**Files:**
- Create: `apps/frontend/components/admin/EventForm.tsx`

- [ ] **Step 1: Write the file**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { createEvent, updateEvent } from '@/lib/api/events';
import { ApiError } from '@/lib/api/client';
import type { CreateEventRequest, EventDto, EventFormat } from '@shared/event';

// The prototype's admin event form (design/static_html/admin-dashboard.html) offers this fixed
// list as a <select>; events.event_type is free text, not an enum, so this form keeps the same
// options as <datalist> suggestions instead of locking the field to them.
const EVENT_TYPE_SUGGESTIONS = ['Tax', 'Legal', 'Audit', 'AI & Tech', 'Fintech', 'Law', 'Startup', 'General'];

const FORMAT_OPTIONS: { value: EventFormat; label: string }[] = [
  { value: 'in_person', label: 'In Person' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'virtual', label: 'Virtual' },
];

function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

interface FormState {
  title: string;
  description: string;
  shortDescription: string;
  startDate: string;
  endDate: string;
  timezone: string;
  eventType: string;
  eventFormat: EventFormat | '';
  country: string;
  city: string;
  venueName: string;
  isFree: boolean;
  registrationUrl: string;
  organiserName: string;
  coverImageUrl: string;
}

function toFormState(event?: EventDto): FormState {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    shortDescription: event?.shortDescription ?? '',
    startDate: toDateInputValue(event?.startDate),
    endDate: toDateInputValue(event?.endDate),
    timezone: event?.timezone ?? '',
    eventType: event?.eventType ?? '',
    eventFormat: event?.eventFormat ?? '',
    country: event?.country ?? '',
    city: event?.city ?? '',
    venueName: event?.venueName ?? '',
    isFree: event?.isFree ?? false,
    registrationUrl: event?.registrationUrl ?? '',
    organiserName: event?.organiserName ?? '',
    coverImageUrl: event?.coverImageUrl ?? '',
  };
}

function toRequestBody(state: FormState, status: 'draft' | 'published'): CreateEventRequest {
  return {
    title: state.title,
    description: state.description,
    shortDescription: state.shortDescription || undefined,
    coverImageUrl: state.coverImageUrl || undefined,
    startDate: state.startDate,
    endDate: state.endDate || undefined,
    timezone: state.timezone || undefined,
    eventType: state.eventType || undefined,
    eventFormat: state.eventFormat || undefined,
    country: state.country || undefined,
    city: state.city || undefined,
    venueName: state.venueName || undefined,
    isFree: state.isFree,
    registrationUrl: state.registrationUrl || undefined,
    organiserName: state.organiserName || undefined,
    status,
  };
}

// Shared by /admin/events/new and /admin/events/[id]/edit — `event` present means edit mode
// (PATCH, prefilled), absent means create mode (POST, blank). Two explicit submit actions
// (Save as draft / Publish) rather than a status dropdown, matching events.status's two real
// states and the product decision made during design (draft-by-default, explicit publish).
export function EventForm({ event }: { event?: EventDto }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => toFormState(event));
  const [busy, setBusy] = useState<'draft' | 'published' | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!state.title.trim() || !state.description.trim() || !state.startDate) {
      setError('Title, description, and start date are required.');
      return;
    }
    setError(null);
    setBusy(status);
    try {
      const body = toRequestBody(state, status);
      if (event) {
        await updateEvent(event.id, body);
      } else {
        await createEvent(body);
      }
      router.push('/admin/events');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save this event.');
      setBusy(null);
    }
  }

  const publishLabel = event ? (event.status === 'published' ? 'Save changes' : 'Publish event') : 'Publish event';

  return (
    <Card padding="lg" className="max-w-3xl">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="Event title"
            value={state.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Global Transfer Pricing Summit"
            required
          />
          <Input
            label="Organizer"
            value={state.organiserName}
            onChange={(e) => set('organiserName', e.target.value)}
            placeholder="e.g. Expertly Network"
          />
        </div>

        <Textarea
          label="Description"
          rows={3}
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          required
        />

        <Textarea
          label="Short description"
          hint="Optional one-line blurb."
          rows={2}
          value={state.shortDescription}
          onChange={(e) => set('shortDescription', e.target.value)}
        />

        <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
          <Input
            label="Start date"
            type="date"
            value={state.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            required
          />
          <Input
            label="End date"
            type="date"
            value={state.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
          <Select
            label="Format"
            value={state.eventFormat}
            onChange={(e) => set('eventFormat', e.target.value as EventFormat | '')}
          >
            <option value="">Not specified</option>
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <div>
            <Input
              label="Category"
              list="event-type-suggestions"
              value={state.eventType}
              onChange={(e) => set('eventType', e.target.value)}
              placeholder="e.g. Tax"
            />
            <datalist id="event-type-suggestions">
              {EVENT_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
          <Input label="City" value={state.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. London" />
          <Input
            label="Country"
            value={state.country}
            onChange={(e) => set('country', e.target.value)}
            placeholder="e.g. United Kingdom"
          />
          <Input
            label="Venue"
            value={state.venueName}
            onChange={(e) => set('venueName', e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="Registration URL"
            type="url"
            value={state.registrationUrl}
            onChange={(e) => set('registrationUrl', e.target.value)}
            placeholder="https://…"
          />
          <Input
            label="Cover image URL"
            type="url"
            value={state.coverImageUrl}
            onChange={(e) => set('coverImageUrl', e.target.value)}
            placeholder="https://…"
          />
        </div>

        <Input
          label="Timezone"
          value={state.timezone}
          onChange={(e) => set('timezone', e.target.value)}
          placeholder="Optional, e.g. Europe/London"
        />

        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={state.isFree}
            onChange={(e) => set('isFree', e.target.checked)}
            className="h-4 w-4 rounded border-line-2 text-accent focus:ring-accent/20"
          />
          This event is free to attend
        </label>

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => handleSave('draft')} disabled={busy !== null}>
            {busy === 'draft' ? 'Saving…' : 'Save as draft'}
          </Button>
          <Button type="button" onClick={() => handleSave('published')} disabled={busy !== null}>
            {busy === 'published' ? 'Publishing…' : publishLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/admin/EventForm.tsx
git commit -m "feat(admin): add shared EventForm for create/edit"
```

---

### Task 12: `/admin/events` list page

**Files:**
- Create: `apps/frontend/app/(shell)/admin/events/page.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminEventsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Eyebrow } from '@/components/ui';
import { AdminEventsList } from '@/components/admin/AdminEventsList';

export const metadata = {
  title: 'Events — Admin — Expertly',
};

// UX-only gate — the real authorization boundary is the backend's @Roles('admin') +
// @RequiresPermission('manageEvents') guard chain (docs/auth.md), re-checked fresh against the
// DB on every request, not trusted from this JWT-derived role. Matches
// app/(shell)/admin/applications/page.tsx exactly.
export default async function AdminEventsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/events');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const events = await getAdminEventsServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <Eyebrow dark>Admin</Eyebrow>
              <h1 className="mt-2 text-headline text-bg-card">Events</h1>
              <p className="mt-3 max-w-xl text-lede text-white/65">
                Add, edit, and remove events on the community calendar. Drafts are only visible
                here — the public calendar only shows published events.
              </p>
            </div>
            <Button href="/admin/events/new" variant="secondary-dark">
              Create event
            </Button>
          </div>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <AdminEventsList initialEvents={events} />
        </PageContainer>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/app/(shell)/admin/events/page.tsx"
git commit -m "feat(admin): add /admin/events list page"
```

---

### Task 13: `/admin/events/new` create page

**Files:**
- Create: `apps/frontend/app/(shell)/admin/events/new/page.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { EventForm } from '@/components/admin/EventForm';

export const metadata = {
  title: 'Create event — Admin — Expertly',
};

export default async function NewAdminEventPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/events/new');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Create event</h1>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <EventForm />
        </PageContainer>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/app/(shell)/admin/events/new/page.tsx"
git commit -m "feat(admin): add /admin/events/new create page"
```

---

### Task 14: `/admin/events/[id]/edit` edit page

**Files:**
- Create: `apps/frontend/app/(shell)/admin/events/[id]/edit/page.tsx`

- [ ] **Step 1: Write the file**

Note: this app is on Next.js 14 (`apps/frontend/package.json`: `"next": "14.2.18"`), where
`params` is a plain object, not a Promise (that's a Next 15 change) — confirmed against
`app/(shell)/members/[id]/page.tsx`'s existing `{ params }: { params: { id: string } }` signature.

```tsx
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminEventServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { EventForm } from '@/components/admin/EventForm';

export const metadata = {
  title: 'Edit event — Admin — Expertly',
};

export default async function EditAdminEventPage({ params }: { params: { id: string } }) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/events/${params.id}/edit`);
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const event = await getAdminEventServer(params.id);
  if (!event) {
    notFound();
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Edit event</h1>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <EventForm event={event} />
        </PageContainer>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/app/(shell)/admin/events/[id]/edit/page.tsx"
git commit -m "feat(admin): add /admin/events/[id]/edit page"
```

---

### Task 15: Frontend manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

Run: `cd apps/backend && pnpm dev` (separate terminal) and `cd apps/frontend && pnpm dev`

- [ ] **Step 2: Non-admin redirect**

Sign in as a `client` or `member` account in the browser, navigate to `/admin/events`.
Expected: redirected to `/dashboard` (or `/login` if signed out).

- [ ] **Step 3: Empty state**

Sign in as an admin with no events yet (or a fresh test DB). Navigate to `/admin/events`.
Expected: "No events yet — create one to get started." message, "Create event" button visible.

- [ ] **Step 4: Create → draft → publish → edit → delete round-trip**

1. Click "Create event", fill in title/description/start date, click "Save as draft".
   Expected: redirected to `/admin/events`, the new event appears with a "Draft" badge.
2. Visit the public `/events` page. Expected: the draft event does **not** appear.
3. Back in `/admin/events`, click "Edit" on the draft, click "Publish event".
   Expected: redirected back to the list, badge now shows "Published".
4. Visit `/events` again. Expected: the event now appears.
5. Back in `/admin/events`, click "Delete", then "Confirm delete".
   Expected: the row disappears from the list without a page reload.

- [ ] **Step 5: Responsive check**

At 375px width: confirm the list rows stack (no horizontal overflow) and the create/edit form's
field grid collapses to one column. At 1440px: confirm the multi-column field grid and month-
grouped list render as designed.

No commit for this task — verification only.

---

## Self-review notes (already applied above)

- **Spec coverage:** every endpoint/field/UI element in
  `docs/superpowers/specs/2026-09-08-admin-events-crud-design.md` maps to a task above, including
  the `GET /admin/events/:id` endpoint the spec's own self-review added.
- **Ordering fix made during planning:** the spec's Task 5.2 described `adminList()` ordering by
  `created_at desc` while also reusing the public page's month-grouping. Combined, that would
  produce out-of-chronological-order month headers (an admin's most-recently-added event isn't
  necessarily the soonest one). Task 3/Task 10 above instead order `adminList()` by `start_date`
  ascending — the same ordering the public list already uses — which is what actually makes "same
  display as the normal events page" (the user's explicit ask) true, and what makes the reused
  month-grouping code correct. This is a fix, not a deviation from the approved design's intent.
- **Type consistency checked:** `EventDto`/`CreateEventRequest`/`UpdateEventRequest` field names
  match between Task 1 (shared types), Task 2 (backend DTOs), Task 3 (service mapping to snake_
  case columns), Task 7 (client), and Task 11 (form) — traced field-by-field while writing this
  plan (`title`, `description`, `shortDescription`, `coverImageUrl`, `startDate`, `endDate`,
  `timezone`, `eventType`, `eventFormat`, `country`, `city`, `venueName`, `isFree`,
  `registrationUrl`, `organiserName`, `status`).
- **`params` typing corrected:** initially drafted as `Promise<{ id: string }>` (a Next 15
  pattern); checked this repo's actual Next version (14.2.18) and an existing dynamic route
  (`members/[id]/page.tsx`) before finalizing Task 14 as a plain object, per this plan's own "no
  placeholders, exact code" requirement.
