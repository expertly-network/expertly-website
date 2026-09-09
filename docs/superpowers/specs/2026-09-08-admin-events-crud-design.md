# Admin Events CRUD — Design Spec

**Status:** Approved — superseded in two places by a later requirements discussion, kept here as
the historical record rather than rewritten: §4.2's DTO requiredness list predates the
publish-required-fields rule (organiser/end date/format/category/city/country/registration URL are
now required once `status` resolves to `'published'`, not unconditionally optional), and §5.2's
"no date-preset/format/country filters" call for the admin list was reversed (it now reuses the
public `EventsList`'s filters, defaulting to "All dates" instead of "Upcoming"). Current contract:
`docs/rest-api.md`'s Events — admin section.
**Scope:** Backend + frontend, done together in this session (not the usual two-session split) —
the feature is small enough that the backend phase (implement + verify the contract without a
frontend, update `docs/rest-api.md`/`docs/database-erd.md`/`packages/shared-types/event.ts`) is
still done first and treated as fixed before the frontend phase starts against it, just without a
session boundary in between.

## 1. Current state

- `events` table already exists (`supabase/migrations/0004_tables.sql`) with every column this
  feature needs, including `status event_status not null default 'draft'`. **No migration
  required.**
- Only `GET /v1/events` is built (`apps/backend/src/events/`), public, `status='published'` only
  (`EventsService.listUpcoming()` / `listAll()`, backed by RLS policy `events_select_published`).
  No write endpoints exist.
- `packages/shared-types/event.ts` has `EventDto`/`EventFormat`/`EventStatus` only — no request
  types yet.
- Frontend has a public `/events` browse page (`app/(shell)/events/page.tsx`,
  `components/events/{EventsList,EventRow}.tsx`) and a homepage teaser. No `/admin` route exists
  for events yet (only `/admin/applications`).
- `admin-permissions.ts`'s `manageEvents` permission already exists in the `ADMIN_PERMISSIONS` map
  but nothing checks it yet — this session is what wires it up.
- Established precedent this spec follows exactly: `AdminApplicationsController` /
  `AdminMembersController` (`@Roles('admin')` + `@RequiresPermission(...)`, `@Controller('admin')`,
  reuses the existing resource service rather than a parallel admin service) and
  `AdminApplicationsTable.tsx` (inline expand-to-confirm row actions, busy/error state per row).

## 2. What this spec adds

1. `AdminEventsController` (`apps/backend/src/events/admin-events.controller.ts`) — `GET/POST
   /admin/events`, `PATCH/DELETE /admin/events/:id`. Gated `@Roles('admin')` +
   `@RequiresPermission('manageEvents')`.
2. `CreateEventDto` / `UpdateEventDto` (class-validator) + admin methods added to the existing
   `EventsService` (`adminList`, `create`, `update`, `delete`) — server-side slug generation
   (`title` → unique slug, same helper shape as `ArticlesService.generateUniqueSlug`).
3. Shared types: `CreateEventRequest` / `UpdateEventRequest` added to
   `packages/shared-types/event.ts`, mirroring `article.ts`'s pair.
4. `docs/rest-api.md` Events section updated with the four new endpoints; the "not built yet" note
   about admin moderation is narrowed to just the suggestion-queue half (still deferred, see §3).
5. Frontend: `/admin/events` (list), `/admin/events/new` (create), `/admin/events/[id]/edit`
   (edit) — all under `app/(shell)/admin/events/`. `EventRow` gains an optional `adminActions`
   slot (edit link + inline delete-confirm) reused by the admin list instead of a forked layout.
   New `lib/api/events.ts` (client mutations) and a server-side admin list fetch in
   `lib/api/server.ts`.

## 3. Explicitly deferred (named, not silently dropped)

- **Public suggestion queue** (`POST /v1/events/suggestions`, admin approve/reject) — full
  `docs/roadmap.md`/US-13-01 scope. Confirmed out of scope for this session; `status` already
  models the state a future session needs, so nothing here blocks it.
- **Registration/RSVP flow** — `registrationUrl` remains a plain URL field the admin can set; no
  booking logic, matching `EventRow`'s existing disabled-CTA treatment when it's empty.
- **Image upload for `coverImageUrl`** — plain URL text input, no signed-upload flow (unlike
  article covers / application documents). Events don't have an upload endpoint and adding one is
  out of scope here.

## 4. Backend

### 4.1 Endpoints (base path `/v1`, all 🛡️ `manageEvents`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/admin/events` | All events regardless of `status`, newest-`created_at`-first |
| `GET` | `/admin/events/:id` | Single event, any status — backs the edit page's prefill (no public by-id endpoint exists to reuse; the public route only ever needed list shapes) |
| `POST` | `/admin/events` | Create. `status` optional — **defaults to `'draft'`** if omitted (matches the column default; the form always sends an explicit choice, so this is a safety net, not the normal path) |
| `PATCH` | `/admin/events/:id` | Partial update, any field including `status` |
| `DELETE` | `/admin/events/:id` | Hard delete, `204` |

### 4.2 DTOs

`CreateEventDto` — required: `title`, `description`, `startDate`. Optional: `shortDescription`,
`coverImageUrl`, `endDate`, `timezone`, `eventType`, `eventFormat` (`in_person`\|`virtual`\|
`hybrid`), `country`, `city`, `venueName`, `isFree` (boolean, default `false`), `registrationUrl`,
`organiserName`, `status` (`draft`\|`published`, default `draft`).

`UpdateEventDto` — every field above optional, same validators, no defaulting (only fields present
in the body are patched).

Validation mirrors `CreateArticleDto`/`UpdateArticleDto`: `@IsString`/`@IsNotEmpty` for required
text, `@IsUrl` for `coverImageUrl`/`registrationUrl`, `@IsIn` for the format/status enums.

### 4.3 Service

`EventsService` gains:
- `adminList(): Promise<EventDto[]>` — no status filter, `order('created_at', {ascending: false})`.
- `adminGetOne(id: string): Promise<EventDto>` — 404 if missing, any status. Backs `GET
  /admin/events/:id`.
- `create(dto: CreateEventDto): Promise<EventDto>` — generates slug from `title`
  (`generateUniqueSlug`, same lowercase/hyphenate/uniqueness-suffix logic as articles, own copy
  since it's a different table), inserts with `status: dto.status ?? 'draft'`.
- `update(id: string, dto: UpdateEventDto): Promise<EventDto>` — 404 via `getRowOrThrow`-style
  lookup if missing, patches only defined fields (same `Record<string, unknown>` patch-building
  pattern as `ArticlesService.update`).
- `remove(id: string): Promise<void>` — 404 if missing, then delete. No owner check needed (admin
  is the only writer of this table — no author concept, unlike articles).

No sanitization needed (`description` isn't rendered as HTML anywhere in the current design —
`EventRow` renders it as plain text via `{event.description}`; if that ever changes, revisit).

### 4.4 Docs / shared-types updates required (part of this implementation, not follow-up)

- `docs/rest-api.md` — add the 4 endpoints under Events, update the "not built yet" note.
- `docs/database-erd.md` — update the "Only `GET /v1/events`... is built" line.
- `packages/shared-types/event.ts` — add `CreateEventRequest`/`UpdateEventRequest`.

## 5. Frontend

### 5.1 Routes

```
app/(shell)/admin/events/
  page.tsx              # list — Server Component, admin-only gate (redirect pattern
                         # matches app/(shell)/admin/applications/page.tsx exactly)
  new/page.tsx           # create — renders EventForm
  [id]/edit/page.tsx     # edit — Server Component fetches the one event via
                         # GET /v1/admin/events/:id, passes it into EventForm
                         # as initial values
```

### 5.2 List (`page.tsx` + a new `AdminEventsList` client component)

- Server Component fetches via `getAdminEventsServer()` (new, in `lib/api/server.ts`, mirrors
  `getAdminApplicationsServer`'s session-cookie + `fetch` pattern).
- Grouped by month same as the public `/events` page (`EventsList`'s existing grouping logic,
  reused, no date-preset/format/country filters — the admin needs to see everything, not a
  filtered subset).
- Each row is `EventRow` with a new optional `adminActions` prop: when present, it renders instead
  of the Register button — an **Edit** link (`Button variant="secondary" href="/admin/events/
  {id}/edit"`) and a **Delete** action using the same inline expand-to-confirm pattern
  `AdminApplicationsTable`'s reject flow already uses (click Delete → confirm/cancel row appears →
  confirm calls `deleteEvent(id)` → row removed from local state on success, `ErrorBanner` on
  failure).
- A `Badge` shows `status` (`draft`/`published`) next to the existing eventType/format badges —
  only rendered in the admin context (public `EventRow` usage passes nothing new, stays unchanged
  visually).
- Empty state: "No events yet — create one to get started." (matches the applications page's
  empty-state tone).
- "Create event" button in the section header, links to `/admin/events/new`.

### 5.3 Form (`components/admin/EventForm.tsx`, shared by create + edit)

Client component. Fields: title, description (textarea), shortDescription (optional textarea),
startDate/endDate (date inputs), timezone (optional text), eventType (text input — free text per
the DB column, not a locked enum, but pre-fills a `<datalist>` with the prototype's 8 category
values as suggestions), eventFormat (select: In Person/Hybrid/Virtual), country, city, venueName,
isFree (checkbox), registrationUrl, organiserName, coverImageUrl — plus a Draft/Publish choice
(two-button submit: "Save as draft" vs. "Publish", matching the schema's own two states rather
than a separate status dropdown).

On submit: calls `createEvent`/`updateEvent` (`lib/api/events.ts`) with the chosen `status`,
`router.push('/admin/events')` on success, `ErrorBanner` + re-enable submit on failure. Busy state
mirrors `AdminApplicationsTable`'s `busy` pattern (disable both submit buttons, show "Saving…" on
the one clicked).

### 5.4 Responsive

`EventRow`'s existing `max-[900px]:grid-cols-1` breakpoint covers the list. The form stacks fields
in a single column below the same breakpoint other multi-field forms in this app use (`Input`/
`Textarea` are already full-width by default) — checked at 375px and 1440px per the non-negotiable
bar, not assumed.

## 6. Error handling

Backend: `NotFoundException` (404) for a missing `:id` on `PATCH`/`DELETE`,
`InternalServerErrorException` (500) on a Supabase error, class-validator's built-in 400s for bad
input — same shape as every other admin controller, no new error-code scheme introduced.

Frontend: every mutation call site catches `ApiError` and renders `ErrorBanner` with
`err.message`, same as `AdminApplicationsTable`/the apply form.

## 7. Verification

`pnpm typecheck` at the repo root. Backend: manual REST-client verification of all 4 endpoints
(auth as admin, as member, as client — confirm 200/403 split) before the frontend phase starts, per
root `CLAUDE.md`'s backend-session methodology, even though there's no session boundary here.
Frontend: dev server, manual browser check of create → list → edit → delete round-trip, plus
375px/1440px, plus the non-admin redirect.
