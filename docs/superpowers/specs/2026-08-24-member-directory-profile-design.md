# Member Directory & Profile Pages — Frontend Design Spec

**Status:** Draft — awaiting review
**Scope:** Frontend only. Backend (`apps/backend/src/members/`), schema (`docs/database-erd.md`),
and REST contract (`docs/rest-api.md`, `packages/shared-types/member.ts`) are already built and
fixed — this spec implements against them as given, per root `CLAUDE.md`'s backend/frontend split.
Covers the full `member-profile.html` scope including the 8-section self-edit proposal flow, per
explicit user instruction (not the smaller read-only-first option originally proposed).

## 1. Current state

- `apps/frontend/` has zero member-facing pages. Existing routes are all pre-auth: `/login`,
  `/forgot-password`, `/reset-password`, `/apply` (+`/apply/submitted`).
- No shared app-shell/sidebar layout exists yet. The design prototype (`design/static_html/`)
  wraps every post-signup-adjacent page (`members.html`, `member-profile.html`, `articles.html`,
  `dashboard.html`, etc.) in a persistent left sidebar shell (`d1-shell`) with role-aware nav items
  (`data-guest-nav` / `data-user-nav` / `data-member-nav`). This spec builds a first real version of
  that shell — it will be reused by future frontend sessions (articles, events, dashboard), so its
  design here is deliberately generic, not members-specific.
- Existing conventions confirmed and followed throughout (no deviation):
  - `lib/api/client.ts`'s `apiFetch<T>()` — Bearer-token client fetch, `ApiError` on non-2xx.
  - `lib/api/<resource>.ts` (client) + `lib/api/<resource>.server.ts` (Server Component variant,
    reads cookies via `@/lib/supabase/server`) — the pattern `applications.ts` already establishes.
  - `lib/auth/session-claims.ts`'s `getSessionUser()` — fast JWT-claims check for nav rendering and
    route gating (this spec's read paths never need the DB-fresh `getCurrentProfile()` tier).
  - `components/ui/*` (Button, Card, Badge, Select, Input, Textarea) — reused as-is; one new base
    primitive is added (§4).
  - No test infrastructure exists in `apps/frontend` (no test script, no `*.test.*` files) —
    verification is `pnpm typecheck` + manual browser check at 375px/1440px, matching how `/apply`
    and the auth pages were verified.
- Prototype behaviors confirmed by direct read (not guessed), used to resolve ambiguity below:
  filter option lists, the completion-percentage checklist, tab→section mapping, the mobile CTA's
  pure-CSS breakpoint trigger, and the auth-wall's guest-facing copy.

## 2. What this spec adds

1. `AppShell` — sidebar layout + route group, role-aware nav, mobile drawer.
2. `/members` — public directory: search, filter (practice area / country / rate), sort,
   infinite-scroll pagination.
3. `/members/[id]` — full profile: auth-wall for guests, tabbed detail view (About / Credentials /
   Articles / Reviews / Contact), sidebar (fee card, verified card, completion card).
4. Self-edit proposal flow — 8 section-specific edit modals, real structured per-field forms (not
   the prototype's single-textarea `·`-delimited shortcut — `docs/rest-api.md` explicitly calls
   that out as not to be reproduced), proof upload via the real 2-step signed-URL flow, pending/
   badge state per section.
5. One new base component: `components/ui/FilterPopover.tsx` (checkbox/radio popover — the
   directory's practice/country/price/sort controls all need this; native `<select>` can't do
   multi-select-with-search the design calls for). Documented in `docs/design-system.md` per its
   own "check here before hand-rolling" convention.

## 3. Explicitly deferred (named, not silently dropped)

- **"Request Consultation" CTA** — rendered present but disabled (`aria-disabled`, tooltip "Coming
  soon"). No consultations backend exists (`consultation_requests` is schema-only per
  `docs/master-tdd.md`); wiring it is out of scope until that session happens.
- **Admin member / member-edit review UI** (`GET/PATCH /v1/admin/members`,
  `/v1/admin/member-edits`, `/v1/admin/renewal-policy`) — `docs/master-tdd.md`'s own routing table
  lists this as a separate future session. Nothing in this spec touches `🛡️` routes.
- **Guest personalization on the auth-wall.** The prototype fills the auth-wall subtext with the
  member's name (`"Sign in to view the full profile of ${name}..."`) because its data is static
  client-side JS. The real `GET /v1/members/:id` 401s for guests entirely, and there's no public
  by-id endpoint to source a name from — so this spec's auth-wall uses generic copy ("Sign in to
  view this profile"). A deliberate, more-correct deviation, not a bug.
- Native share fallback beyond `navigator.share`/clipboard-copy, PDF export — minor prototype
  conveniences, included only if trivial once the rest is done, never blocking.

## 4. Architecture

### 4.1 Route structure

```
app/
  (shell)/                     # new route group — wraps children in AppShell
    layout.tsx                 # calls getSessionUser(), passes to AppShell
    members/
      page.tsx                 # directory — Server Component, reads searchParams
      [id]/
        page.tsx                # profile — Server Component
      error.tsx                 # shared error boundary for both
```

`(shell)` is a route group (no URL segment) so `/members` and `/members/[id]` stay at the paths the
contract/design imply. Existing routes (`/login`, `/apply`, etc.) are untouched — they stay outside
`(shell)`, since none of them use the sidebar shell in the design.

### 4.2 `AppShell`

- `components/layout/AppShell.tsx` — Server Component. Props: `user: Profile | null`, `children`.
  Renders `Sidebar` + `<main>`.
- `components/layout/Sidebar.tsx` — nav list, role-aware visibility:
  - Always: logo, **Members** (this session's only real destination — Articles/Events/etc. stay
    absent from the nav until their own sessions ship, rather than linking to pages that don't
    exist yet; this is a deliberate content decision, not a placeholder oversight).
  - Guest (`user === null`): "Apply Now" (primary) + "Sign In" in the footer.
  - Signed in: avatar + name + role-appropriate label in the footer, sign-out action.
  - No `member`-only nav items exist yet (Dashboard, Peer Connect, etc. aren't built) — the
    `data-member-nav` prototype section is not ported until those pages exist.
- Mobile (**&lt;1024px**, matching the prototype's own `mp-mobile-cta` breakpoint so the shell and
  the profile page agree on one breakpoint): sidebar collapses to a slim top bar (logo + hamburger).
  Hamburger opens a full-height drawer (`Client Component`, local `useState`, closes on route
  change or backdrop click). No prototype reference for this collapse — built fresh per
  `CLAUDE.md`'s mobile-first mandate, checked at 375px and 1440px.

### 4.3 Data layer

New files, mirroring `lib/api/applications.ts` / `applications.server.ts` exactly:

- `lib/api/members.ts` (client):
  `getMembers(params: MemberListParams): Promise<MemberListItemDto[]>`,
  `getMember(id): Promise<MemberDto>`,
  `getMyMemberEdits(id): Promise<MemberProfileEditDto[]>`,
  `createMemberEdit(id, body: CreateMemberEditRequest): Promise<MemberProfileEditDto>`,
  `requestMemberUpload(id, body: UploadRequest): Promise<UploadResponse>`.
- `lib/api/members.server.ts` (server): `getMembersServer`, `getMemberServer` — same shape as
  `getMyApplicationServer`, used for the two pages' initial SSR fetch.
- `lib/api/upload.ts`: `uploadToSignedUrl(uploadUrl: string, file: File): Promise<void>` — a bare
  `PUT` with the file as body and `Content-Type` set from `file.type`, no `apiFetch` wrapper (this
  goes straight to Supabase Storage, not the backend). New file because this signed-URL pattern is
  genuinely different from `uploadApplicationFile`'s direct-multipart-to-backend pattern — they are
  not the same shape and must not be forced into one helper.
- `lib/members/completion.ts`: `computeCompletionPct(member: MemberDto): number` — ports the
  prototype's 10-point checklist 1:1 onto `MemberDto`'s real field names:
  `photoUrl`, `headline`, `bio`, `engagements.length>0`, `educations.length>0`,
  `workExperiences.length>0`, `contactEmail`, `contactPhone`, `linkedinUrl`,
  `rateMinCents && rateMaxCents`. `pct = round(passed/10 * 100)`.
- `lib/members/edit-badge.ts`: `getSectionEditBadge(section, edits: MemberProfileEditDto[]): 'pending' | null` —
  returns `'pending'` if the latest edit for that section is `status === 'pending'`, else `null`.
  Per the prototype's own explicit design decision, **not called for `education` /
  `work_experiences`** — those two sections show no section-level badge ("too many small, evolving
  facts to badge individually there"), edits still submit normally.

## 5. `/members` — directory page

- `app/(shell)/members/page.tsx` (Server Component): parses `searchParams` (`q`, `practiceAreaId[]`,
  `country[]`, `rateMinCents`, `rateMaxCents`, `sort`, `page`), calls `getMembersServer()` for page 1
  (`pageSize=8` per the contract default), also calls `getPracticeAreas()` (existing) for the filter
  popover's option list.
- `components/members/DirectoryFilterBar.tsx` (Client Component): four `FilterPopover`s —
  - **Practice area** — multi-select, options = real `GET /v1/practice-areas` (not hardcoded).
  - **Country** — multi-select, options = a static list module `lib/members/countries.ts` (the
    contract takes free-form `country` strings; the prototype's 196-country static list is the only
    available source of an option set — ported as data, not reproduced as UI logic).
  - **Rate** — single-select mapped to `rateMinCents`/`rateMaxCents` pairs: Under $300/hr, $300–400,
    $400–500, $500–600, $600+ (prototype's own buckets, values ×100 for cents).
  - **Sort** — single-select: Featured (`featured`, default) / Most experienced (`tenure`) / Rate:
    low→high (`rate_asc`) / Rate: high→low (`rate_desc`) — contract's actual enum values, not the
    prototype's `rate-asc`/`rate-desc` spelling.
  - Free-text `q` search input (Input.tsx), debounced 300ms.
  - Changing any control updates the URL's `searchParams` (`router.replace`, shallow) — filter state
    lives in the URL, not component state, so the page is linkable/shareable and the initial SSR
    fetch and client refetches share one source of truth.
- `components/members/MemberDirectoryList.tsx` (Client Component): receives the server-fetched page
  1 as initial state, appends subsequent pages on scroll via an `IntersectionObserver` on a sentinel
  div (mirrors the prototype's `mv4-scroll-sentinel`), calling `getMembers()` client-side with
  `page: n+1` and the current filters. Loading-more state shows 2 skeleton cards appended at the
  bottom; end-of-results shows nothing extra (no "you've reached the end" — not in the design).
- `components/members/MemberCard.tsx`: avatar (photo or initials-on-`neon`-gradient fallback per
  design tokens), verified badge (`Badge variant="brand"` + checkmark, shown when `isVerified`),
  name, headline, firm · region/city, tenure (`"${yearsOfExperience}y"`, formatted client-side per
  the contract's note that display strings aren't returned by the API), rate
  (`"$${rateMinCents/100}–${rateMaxCents/100}/hr"`, or "Rate on request" if either is null),
  practice-area chips (`Badge variant="neutral"`, capped at 3 + "+N").
- Empty state (zero results): centered message + "Reset filters" button (`Button variant="secondary"`),
  matching `dir-empty-state`.
- Loading (initial SSR page has none — it's server-rendered; client-side filter changes show a full
  skeleton grid of 8 `MemberCard`-shaped skeletons while refetching).
- Sidebar (`components/members/DirectorySidebar.tsx`): static trust-signal card (100% manual review
  / 0 junior associates / 20+ jurisdictions copy, ported verbatim — it's marketing copy, not data)
  + "Apply for membership" CTA linking to the already-built `/apply`. Hidden below 1024px (stacks
  beneath the list on mobile, per the mobile-first responsive mandate — no prototype reference,
  design-system `Card` used directly).

## 6. `/members/[id]` — profile page

- `app/(shell)/members/[id]/page.tsx` (Server Component):
  1. `getSessionUser()` (fast JWT check). `null` → render `<ProfileAuthWall />` and stop — no
     attempt to call the 🔒 endpoint (would just 401; no reason to round-trip).
  2. Signed in → `getMemberServer(id)`. `404` → `notFound()`. Other errors bubble to `error.tsx`.
  3. `isOwnProfile = sessionUser.id === member.id` — valid per `docs/database-erd.md`'s
     confirmation that `MemberDto.id` **is** `member_profiles.profile_id`, i.e. the same id as
     `profiles.id`/the JWT `sub` (verified directly against the schema doc, not assumed).
  4. If `isOwnProfile`, also fetch `getMyMemberEditsServer(id)` for badge state; guests-viewing-
     another-member's-profile never see edit state (not their data to know).
- `components/members/ProfileAuthWall.tsx`: generic copy per §3's deviation, "Sign in" (`Button`,
  links to `/login?returnTo=/members/[id]`) + "Apply for membership" secondary link.
- `components/members/ProfileHeader.tsx`: avatar, verified badge + name, tier badge
  (`Badge variant="emphasis"` for `memberTier`), headline/designation, firm, stats row (tenure ·
  region), share button (`navigator.share` if available, else copy-link + toast).
- `components/members/ProfileTabs.tsx` (Client Component, local tab state, no URL sync — matches
  the prototype, tabs aren't deep-linkable there either): About / Credentials / Articles / Reviews /
  Contact. Tab→content mapping (confirmed from prototype DOM order):
  - **About**: Headline & Bio (`headline_bio`) → Key Engagements (`engagements`) → Key Clients
    (`keyClients`).
  - **Credentials**: Education (`education`) → Work Experience (`workExperiences`) — no section
    badges (see §4.3).
  - **Articles**: `getArticles({ authorId: member.id })` (existing articles endpoint's own
    `authorId` param — no new backend call), simple list, no sub-sections.
  - **Reviews**: Client Testimonials (`testimonials`) → Awards & Recognition (`awards`); shared
    empty state if both arrays are empty.
  - **Contact**: Contact Information (`contact`) alone.
- `components/members/ProfileSidebar.tsx`: fee card (rate + availability + **disabled**
  "Request Consultation" button, §3) + firm-website link; verified card (shown when `isVerified`);
  completion card (shown only when `isOwnProfile` — a guest has no reason to see another member's
  profile-completeness metric), using `computeCompletionPct`.
- Mobile CTA bar (`components/members/MobileCtaBar.tsx`): fixed-bottom, pure CSS
  `lg:hidden` (Tailwind's `1024px` breakpoint aligns with the prototype's `1023px` cutoff closely
  enough to reuse directly) — always rendered below that width regardless of any other state,
  matching the prototype's unconditional CSS-only trigger exactly. Same disabled-CTA treatment.

## 7. Self-edit proposal flow (8 sections)

Edit (pencil) buttons render only when `isOwnProfile`. One shared modal component, config-driven:

- `components/members/edit/SectionEditModal.tsx` — Client Component, takes a `section` prop, looks
  up its config, renders the right form shape:
  - **`fields`** (single structured form, no proof) — `headline_bio`, `contact`.
  - **`list-shared-proof`** (repeatable structured rows, one proof for the whole batch) —
    `education`, `work_experiences`.
  - **`list-per-item-proof`** (repeatable structured rows, proof per row) — `engagements`,
    `testimonials`, `awards`.
  - **`clients`** (repeatable rows, per-row logo upload instead of proof) — `key_clients`.
- `components/members/edit/sectionFieldConfig.ts` — one config object mapping each
  `MemberEditSection` to its real structured field list, typed directly off
  `packages/shared-types/member.ts`'s per-section payload types (`HeadlineBioEditPayload`,
  `EngagementsEditPayload`, etc.) — **not** the prototype's one-textarea-`·`-split shortcut, which
  is the exact pattern `docs/rest-api.md` names as something not to reproduce. E.g. `engagements`
  renders 4 real inputs per row (title, organization, year, url), not one free-text line.
- Proof UI: file-or-link toggle (radio-style pill pair), file input (`accept` per contract's
  `file-type` magic-byte validation happening server-side — client only restricts by `accept`
  attribute as a UX hint, never trusts extension), text input for a URL. Submission flow for a file:
  `requestMemberUpload({fileName, contentType})` → `uploadToSignedUrl(uploadUrl, file)` → include
  the returned `path` as `proofFileUrl` in the edit submission. This is the real 2-step flow the
  contract defines — not the prototype's `FileReader`-to-data-URL placeholder.
- `key_clients`' logo upload reuses the same signed-upload call, result goes into
  `logoUploadPath` per `KeyClientsEditPayload`.
- Client-side validation: required fields per the shape (matches DTO validation server-side would
  reject anyway), and for `list-per-item-proof` / `list-shared-proof`, at least one of file/link
  proof before the submit button enables — mirrors `mp-edit-proof-error`'s existing UX intent.
- On submit: `createMemberEdit(memberId, { section, payload, proofFileUrl?, proofLink? })` →
  `201`. Modal closes, section badge flips to "Pending verification" optimistically (re-fetch of
  `getMyMemberEdits` confirms). `400`/`403` surface as an inline error banner in the modal
  (`error.code`-driven per root `CLAUDE.md`'s error-handling rule), not a silent failure.
- Badge component: `components/members/SectionBadge.tsx` — renders "Pending verification" when
  `getSectionEditBadge` returns `'pending'`; otherwise renders nothing (no inferred "verified"
  section state exists in the contract beyond the per-item `isVerified` flags already shown
  elsewhere). Neither of `Badge`'s existing variants (`neutral`/`emphasis`/`brand`) fits an
  in-review/caution state — none of the design system's existing colors (`ok`=success,
  `error`=destructive) fit either. Uses Tailwind's default `amber-50`/`amber-700` directly rather
  than inventing a new CSS-variable token for a single call site — see §9.

## 8. Error / loading / empty states (Code Quality Bar checklist)

| Surface | Loading | Error | Empty |
|---|---|---|---|
| Directory (SSR page 1) | N/A (server-rendered) | `error.tsx` boundary | `dir-empty-state` equivalent, §5 |
| Directory (filter refetch) | 8-card skeleton grid | inline banner above list + retry | same empty state |
| Directory (load more) | 2 trailing skeleton cards | inline banner at list end + retry | N/A |
| Profile (SSR) | N/A | `notFound()` on 404; `error.tsx` otherwise | N/A (profile always has required fields) |
| Articles tab | inline spinner in tab panel | inline retry message | "No published articles yet" |
| Edit modal submit | button spinner, fields disabled | inline banner, form stays open | N/A |
| Edit modal upload | progress text ("Uploading…") | inline banner, retry button | N/A |

## 9. `docs/design-system.md` updates required by this spec

- New component row: `FilterPopover` (§4.3).
- New color: a "pending" amber for `SectionBadge` — the existing palette has `ok` (success) and
  `error` but nothing for an in-review/neutral-caution state. Proposed: reuse Tailwind's default
  `amber-600`/`amber-50` pair (not a new CSS variable) since this is the first and, per this
  spec's scope, only place needing it — matches the doc's own guidance to add a token "if a value
  you need isn't one yet," scoped minimally rather than inventing a new brand color.

## 10. File map

**New:**
```
app/(shell)/layout.tsx
app/(shell)/members/page.tsx
app/(shell)/members/[id]/page.tsx
app/(shell)/members/error.tsx
components/layout/AppShell.tsx
components/layout/Sidebar.tsx
components/layout/MobileDrawer.tsx
components/ui/FilterPopover.tsx
components/members/DirectoryFilterBar.tsx
components/members/DirectorySidebar.tsx
components/members/MemberDirectoryList.tsx
components/members/MemberCard.tsx
components/members/ProfileAuthWall.tsx
components/members/ProfileHeader.tsx
components/members/ProfileTabs.tsx
components/members/ProfileSidebar.tsx
components/members/MobileCtaBar.tsx
components/members/SectionBadge.tsx
components/members/tabs/AboutTab.tsx
components/members/tabs/CredentialsTab.tsx
components/members/tabs/ArticlesTab.tsx
components/members/tabs/ReviewsTab.tsx
components/members/tabs/ContactTab.tsx
components/members/edit/SectionEditModal.tsx
components/members/edit/sectionFieldConfig.ts
lib/api/members.ts
lib/api/members.server.ts
lib/api/upload.ts
lib/members/completion.ts
lib/members/edit-badge.ts
lib/members/countries.ts
```

**Modified:**
```
docs/design-system.md   — FilterPopover entry + pending-amber note (§9)
```

No backend, migration, `docs/rest-api.md`, `docs/database-erd.md`, or `packages/shared-types/`
changes — the contract is fixed and this spec implements against it as-is.

## 11. Open questions resolved during brainstorming (recorded for traceability)

- Session scope: full `member-profile.html` scope including self-edit, chosen explicitly over a
  smaller read-only-first cut.
- Process: spec-first (this document), reviewed before implementation begins.
