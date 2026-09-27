# Admin Application Review Detail Page — Design Spec

**Status:** Approved.
**Scope:** Backend + frontend, done together in this session (not the usual two-session split) —
per the brief this was scoped from, the contract is small and fully specified upfront, so the
backend phase (implement + verify without a frontend, update `docs/rest-api.md`/
`packages/shared-types/membership-application.ts`) is still done first and treated as fixed before
the frontend phase starts against it, just without a session boundary in between.

## 1. Current state

- `AdminApplicationsController` (`apps/backend/src/applications/admin-applications.controller.ts`)
  has `GET /admin/applications` (list, defaults to `submitted`+`under_review`) and
  `PATCH /admin/applications/:id` (approve/reject) — both gated `@Roles('admin')` +
  `@RequiresPermission('manageApplications')`. No `GET /admin/applications/:id` yet.
- `ApplicationsRepository.findByIdForReview(id)` already exists and already selects every column
  on `membership_applications` (`APPLICATION_ROW_COLUMNS`, including
  `background_check_consent`/`terms_version_agreed`/`privacy_version_agreed`) — it's already used
  internally by `reviewApplication()`. Nothing to add at the repository layer.
- `ApplicationsService.toDto()` is private and maps a row to `ApplicationDto`, but currently omits
  `background_check_consent`/`terms_version_agreed`/`privacy_version_agreed` — only
  `linkedin_import_consent` is exposed today.
- `ReviewApplicationDto` (backend) / `AdminApplicationReviewRequest` (shared-types) currently carry
  `status`, `rejectionReason`, `approvedServiceId` only. `reviewApplication()` on approve always
  sets `member_tier: application.selected_tier` and never sets `membership_started_at` (relies on
  the DB's `now()` default).
- `member_profiles.member_tier`/`membership_started_at` columns already exist
  (`docs/database-erd.md`: `member_tier` is already documented as "admin-overridable at approval" —
  this session is what actually wires that up). **No migration needed.**
- Frontend: `AdminApplicationsTable.tsx` does inline approve (service picker) / reject (reason
  textarea) per table row. `ReviewSubmitStep.tsx` (the applicant's own review step) defines
  `ReviewRow`/`ReviewListRow` presentational components, private to that file, that render a
  labeled row or a labeled list of structured entries — exactly the layout a read-only admin detail
  view needs, but for `WizardFormState` (client wizard state), not `ApplicationDto` directly. No
  frontend page renders `ApplicationDto.documents` anywhere yet (not even applicant-side).
- `/admin/applications/[id]` route doesn't exist. `admin/events/[id]/edit/page.tsx` is the closest
  existing pattern for an admin detail route (`getSessionUser()` gate, `notFound()` on missing
  resource, `PageContainer`/`Eyebrow` header).

## 2. Decisions made resolving open questions in the brief

1. **No `member_profiles.approved_by` column.** The reviewing admin is already traceable via
   `member_profiles.application_id` → `membership_applications.reviewed_by`. Confirmed with the
   user — explicitly do not add a direct column; the indirect FK trace is sufficient.
2. **Extend `ApplicationDto`** with `backgroundCheckConsent: boolean | null`,
   `termsVersionAgreed: string | null`, `privacyVersionAgreed: string | null` — additive, no
   version bump. This also means the applicant's own `GET /v1/applications/me` gains these fields,
   which is a harmless side effect (more consent visibility, not less), not just an admin-side
   change.

## 3. What this adds

### Backend

1. `GET /v1/admin/applications/:id` (🛡️ `manageApplications`) — returns `ApplicationDto`, the
   exact same shape `GET /v1/applications/me` returns for the applicant themselves. Implemented as
   `ApplicationsService.getForReview(id)`, reusing `findByIdForReview()` + the same
   `resolveServiceDetails()` + `toDto()` path `reviewApplication()` already uses internally — no
   new repository method, no new DTO class.
2. `ApplicationDto`/`toDto()` gain `backgroundCheckConsent`/`termsVersionAgreed`/
   `privacyVersionAgreed`, mapped straight from the row (already selected by every existing query
   that returns `APPLICATION_ROW_COLUMNS`). Also gains `rejectionReason` (same reasoning —
   `rejection_reason` is already a selected column, and the detail page needs to show why an
   already-rejected application was rejected; caught during plan self-review, not part of the
   original two consent-field decision above but the same kind of additive fix).
3. `AdminApplicationReviewRequest`/`ReviewApplicationDto` gain two optional fields, used only when
   `status: 'approved'`:
   - `memberTier?: MembershipTier` — admin override. Validated `@IsIn([...])` same pattern as
     `UpdateAdminMemberDto.status`. Falls back to `application.selected_tier` when omitted.
   - `membershipStartedAt?: string` — `@IsDateString()`, same pattern as
     `UpdateAdminMemberDto.membershipStartedAt`. Falls back to "now" when omitted — computed
     explicitly in the service (`new Date().toISOString()`) and always passed into
     `insertMemberProfile()`, rather than omitting the column and relying on the DB's `now()`
     default the way the code did before this change. Same effective behavior, but explicit: the
     inserted row's `membership_started_at` is always traceable to a value this call actually
     decided, not an implicit column default.
4. `reviewApplication()`'s approve branch: `member_tier: dto.memberTier ?? application.selected_tier`,
   `membership_started_at: dto.membershipStartedAt ?? new Date().toISOString()`. Everything else
   (service-preference validation, `member_services` provisioning, `promoteToMember`,
   `markApproved` stamping `reviewed_by`/`reviewed_at`) is unchanged — this only touches the
   `insertMemberProfile()` call's payload.

### Frontend

5. `ReviewRow`/`ReviewListRow` move out of `ReviewSubmitStep.tsx` into a new shared file,
   `components/shared/ApplicationReview.tsx` — pure presentational components, no
   `WizardFormState`/`ApplicationDto`-specific logic inside them (both callers already do their own
   field mapping before passing `items`/`value` in). `ReviewSubmitStep.tsx` imports them instead of
   defining them.
6. New `components/admin/ApplicationReviewDetail.tsx` (client component) — read-only render of
   every `ApplicationDto` field (identity, bio, work history, education, peer references,
   services/rates, documents, photo, consents) using `ReviewRow`/`ReviewListRow`, plus a decision
   panel below it with the approve/reject actions ported as-is from
   `AdminApplicationsTable.tsx`'s row logic:
   - Approve: service picker (`Select`, one of the applicant's submitted `servicePreferences`,
     required), tier `Select` (defaults to `application.selectedTier`), membership start date
     `Input type="date"` (defaults to today, editable).
   - Reject: reason `Textarea`, required.
   - On success, redirect back to `/admin/applications` (`useRouter().push`) — the list re-fetches
     server-side on navigation, so no client-side cache to invalidate.
7. New `app/(shell)/admin/applications/[id]/page.tsx` — mirrors
   `admin/events/[id]/edit/page.tsx`'s gate pattern exactly (`getSessionUser()`, redirect
   non-admins, `notFound()` on a missing/404 application), fetches via a new
   `getAdminApplicationServer(id)` in `lib/api/server.ts` (mirrors `getAdminEventServer`), renders
   `ApplicationReviewDetail`.
8. `AdminApplicationsTable.tsx` simplifies to a plain list: each row shows the same summary
   columns it does today (applicant, tier, payment, status) plus a "Review" link
   (`next/link` to `/admin/applications/${id}`) instead of the inline approve/reject/service-picker
   UI. No more per-row state, no more `reviewApplication` import, no more `onDecided` callback —
   the component no longer needs to be a Client Component at all (no interactivity left beyond a
   plain link).

## 4. Explicit non-goals (confirmed against the brief)

- The detail page is **read-only** for everything the applicant submitted (bio, rates, work
  history, education, peer references, documents, photo). Only service, tier, and start date are
  admin-decided at approval time — not corrections. Post-approval corrections to a member's
  profile go through the existing `member_profile_edits` proof-gated flow
  (`POST /v1/members/:id/edits`, `PATCH /v1/admin/member-edits/:id`), untouched by this change.
- No `member_profiles.approved_by` column (see §2.1).
- No change to reject behavior beyond moving its UI to the detail page — still
  `rejectionReason` required, still stamps `reviewed_by`/`reviewed_at` only.
