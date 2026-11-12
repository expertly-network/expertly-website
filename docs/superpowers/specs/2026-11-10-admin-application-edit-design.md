# Admin application review: corrections, any-service approval, full service path

Date: 2026-11-10 · Branch: `feature/admin-application-edit` · Story: US-08-01 (extended)

## Problem

On the admin review page (`/admin/applications/[id]`) an admin today can only pick a tier, a start
date and one of the applicant's three preferred services, then approve or reject. They cannot:

1. Correct anything the applicant entered — names, contact/work email, phone, location, years of
   experience, rates, bio, LinkedIn, work experience history, education history.
2. Approve the member for a service other than the applicant's three preferences.
3. See which service line and category a preferred service sits under. The taxonomy is three levels
   (service line → category → service, e.g. Tax › Transfer Pricing › Benchmarking) and service
   names repeat across categories, so the bare name is ambiguous. The detail page shows only the
   service name; the list table shows the category but not the service line.

## Decisions (agreed with the product owner)

- **The application is never modified.** Admin corrections apply only to the member profile created
  on approval. The application row stays exactly as the applicant submitted it.
- **Corrections travel with the approve request.** No server-side draft: unsaved edits are lost if
  the admin rejects or leaves the page.
- **Exactly one approved service**, chosen from any active, non-custom service in the taxonomy. The
  applicant's preferences are offered first.
- Everything that reaches the member profile is editable. Peer references, consents, coupon and
  payment fields never reach the profile and stay read-only.
- **The photo is the one exception (decided 2026-11-12):** the admin replaces the application's own
  photo, immediately, via `POST /v1/admin/applications/:id/photo` (same Storage path as the
  applicant's upload, so the original isn't kept). Chosen for simplicity over a separate admin
  photo carried as an override.

## Backend contract — `PATCH /v1/admin/applications/:id` (additive, stays `/v1`)

`ReviewApplicationDto` changes:

- `approvedServiceId` — still required when approving. Now accepted if it is **any active,
  non-custom service**, or one of the applicant's own preferences (which may be a custom service
  they created). Anything else → `400 APPROVED_SERVICE_INVALID` (unchanged code). When the id matches
  a preference, that preference's `customLabel` is carried onto `member_services`; otherwise
  `custom_label` is null.
- `profileOverrides?: ApplicationProfileOverrides` — new, approve-only. Every key optional:
  `firstName`, `lastName`, `contactEmail`, `workEmail`, `phoneCountryCode`, `phone`, `region`,
  `country`, `state`, `city`, `linkedinUrl`, `bio`, `yearsOfExperience`, `rateMinCents`,
  `rateMaxCents`, `workExperiences` (whole array), `educations` (whole array). Validated with the
  same decorators and limits as the applicant's `UpdateApplicationDto` / `WorkExperienceDto` /
  `EducationDto` (`field-limits.ts`), so an admin can't store what an applicant couldn't.
  `forbidNonWhitelisted` rejects unknown keys.
- Sending `profileOverrides` with `status: 'rejected'` → `400 OVERRIDES_ON_REJECT`.

Service behaviour (`ApplicationsService.reviewApplication` / `buildMemberProfile`):

- Each `member_profiles` field = override if present, else the application value (contact
  phone is still joined from country code + number).
- Names: a member's displayed name lives on the account row (`profiles.first_name/last_name`),
  not on `member_profiles`, and approval doesn't copy names today. When `firstName`/`lastName` is
  overridden, the slug is built from the corrected name and the `profiles` row is updated in the
  same step that promotes the role (`promoteToMember` gains optional name fields). Rollback runs
  before that step, so a failed approval never leaves a renamed account.
- Tier: explicit `memberTier` wins; else if `yearsOfExperience` is overridden, `computeTier(new
  years)`; else the application's `selected_tier` (today's behaviour).
- The `APPLICATION_INCOMPLETE` check runs against the merged values, so an admin can fill in a
  missing country or years of experience and approve.
- Rate check: merged `rateMaxCents` must exceed merged `rateMinCents` (the DB check) →
  `400 INVALID_RATE_RANGE` before any write.
- The approved service must still be active at approval time.

## Response additions (additive)

`ServicePreference` gains `serviceLineId` and `serviceLineName` (resolved in
`findServiceDetails`, which already joins categories). Returned by both `GET /v1/applications/me`
and the admin endpoints.

## Frontend

- **Full path everywhere a preference is shown:** "Tax › Transfer Pricing › Benchmarking" on the
  review page (services section + decision picker) and the admin applications table.
- **Edit mode** on the review page: an "Edit details" toggle turns the profile sections into form
  fields, reusing the wizard's own field components (location, work history, education) rather
  than copies. Out of edit mode, the read-only rows show the corrected values with the applicant's
  original struck through (the review page's existing `previous` display), plus an "N fields
  corrected" badge and one "Discard corrections" action. Only changed fields are sent as
  `profileOverrides`; reject never sends them. Clearing a field to blank isn't supported (a
  correction replaces a value, it doesn't delete one).
- **Service picker:** searchable list over `GET /v1/service-lines`, each option labelled with its
  full path; the applicant's three preferences pinned on top with their priority.
- Mobile-first, checked at 375 px and 1440 px.

## Same change

`docs/rest-api.md`, `docs/user-stories.md` (US-08-01 criteria),
`packages/shared-types/membership-application.ts`, Postman request for the PATCH (primary body
gains a `profileOverrides` example; reject variant in its description). No migration.

## Tests (backend service specs)

- Overrides land on the profile insert; the application row is not updated beyond the decision.
- Any active service accepted; inactive/unknown rejected; custom label only carried when the service
  matches a preference.
- Tier: explicit > recomputed from overridden years > application.
- Overrides on reject → 400; bad rate range → 400; missing country filled by override → approves.

## Out of scope

Saving corrections before approving; approving several services; editing peer references,
consents, documents or payment; editing an already approved member (that's the member-edits flow).
