# User Stories — GrowXQ Platform

Status badges match `docs/master-tdd.md`'s conventions: ✅ Built · 🧱 Schema only, no API ·
📋 Roadmap (scoped in `docs/roadmap.md`, nothing built) · 🔭 Beyond-roadmap (sketched, not
committed). A story's acceptance criteria describe the **intended** behavior regardless of status —
for 📋/🔭 stories, treat them as a draft to validate during that feature's own design session, not
a spec to implement verbatim.

Design source for every story is the matching `design/static_html/*.html` page, per root
`CLAUDE.md`'s methodology — check it before implementing, don't design from the story text alone.

---

## US-01 — Guest Experience ✅

### US-01-01: Discovering GrowXQ for the first time
As a visitor, I want to understand what GrowXQ is and see credible signals (featured members,
articles, practice areas) so I can decide whether to sign up or apply.
- [ ] Homepage renders without auth, with featured members, latest articles, and categories
      marquee sourced from the real APIs (`GET /v1/members`, `GET /v1/articles`, `GET /v1/categories`)
- [ ] No login-walled content is visible in a guest session
- [ ] Primary CTAs ("Apply as a member", client signup) are visible above the fold

### US-01-02: Browsing the member directory as a guest
As a visitor, I want to search and filter vetted experts so I can find someone relevant before
committing to sign up.
- [ ] `GET /v1/members` supports search (name/practice/location/firm/title), filter (practice area,
      country, price-range bucket), sort, and pagination per `docs/rest-api.md`
- [ ] Guest can view a member's full public profile (`GET /v1/members/:slug`)
- [x] A member's contact details (`contactEmail`, `workEmail`, `contactPhone`, `linkedinUrl`) are
      returned only to the profile owner, admins with `manageMembers`, active members, and clients
      who have sent that member a consultation request (any status); everyone else gets `null` plus
      `contactVisible: false`, and the Contact tab and profile PDF explain the gap ("shared with
      members and with clients who have a consultation with this member") instead of an empty state (implemented 2026-10-30, `docs/rest-api.md`
      `GET /v1/members/:slug`)

### US-01-03: Reading a published article as a guest
As a visitor, I want to read member-authored articles so I can evaluate the platform's expertise
before signing up.
- [x] `GET /v1/articles` returns only `published` articles to unauthenticated callers
- [x] `GET /v1/articles/:id` 🔑 requires auth for full body per `docs/rest-api.md` — guest sees list
      + excerpt only, not full body, unless that's since changed in the contract (frontend:
      `/articles/[slug]` fetches the public list and shows a title+excerpt preview for guests,
      rather than calling the gated endpoint)

---

## US-02 — Signup and Authentication ✅

### US-02-01: Signing up as a client
As a prospective client, I want to sign up with email/password so I can book consultations and
apply for membership later.
- [ ] `client` tab on the combined login/signup page auto-detects login-vs-signup (tries sign-in,
      falls back to sign-up only on `invalid_credentials`)
- [ ] Doesn't leak whether an email is already registered via error text (uses Supabase's
      `identities: []` signal instead)

### US-02-02: Logging in as a member via LinkedIn
As a vetted expert, I want to log in via LinkedIn OAuth (no password) so my identity is verified
through a professional network.
- [ ] `member` tab is LinkedIn-only, no password field
- [ ] PKCE code-exchange completes via `/auth/callback` and redirects to the public domain, not
      `0.0.0.0` or a build-time host (see commit history — this regressed once already)
- [ ] Session is cookie-based (`@supabase/ssr`), readable by Server Components and middleware

### US-02-03: Returning to where I was after login
As a user, I want to land back on the page I was trying to reach before being redirected to log in.
- [ ] Middleware-protected routes (currently `/dashboard`, `/apply`) redirect unauthenticated users
      to `/login` and back to the original path after success

### US-02-04: Role-aware routing after login
As a user, I want to land on the right surface for my role immediately after authenticating.
- [ ] `client` → homepage or intended destination; `member` → `/dashboard`; `admin` → admin surface
- [ ] Role is read from the verified JWT's `app_role` claim locally, no extra network round trip

---

## US-03 — Applying for Membership ✅

### US-03-01: Starting an application
As a client, I want to apply to become a vetted member so I can offer consultations and publish
articles.
- [x] `POST /v1/applications/me` (upsert — see `docs/superpowers/specs/2026-08-23-member-application-form-design.md`)
      per `docs/rest-api.md`; duplicate-application prevention per `apps/backend/src/applications/`
      — a `rejected` applicant may start a fresh application, `submitted`/`under_review`/`approved`
      may not.

### US-03-02: Completing the application wizard
As an applicant, I want a multi-step form (identity, background, services & rates, review &
submit) matching `apply.html`/`onboarding_form.html` so the process feels structured, not a wall
of fields.
- [x] Each step validates independently before advancing (see `components/apply/steps/*`)
- [x] LinkedIn import step pre-fills identity/background where available (real fetch against
      `N8nLinkedInImportProvider` — the mock fallback was removed 2026-09-26; a missing
      `LINKEDIN_IMPORT_WEBHOOK_URL` now throws instead of returning fake data — see the spec doc
      §5) — imported fields are visually tagged and the tag clears the moment the applicant edits
      that field. Applicants who signed up via email/password must first connect a real LinkedIn
      account (OAuth identity link, not just a pasted URL) before this step proceeds — see
      `docs/auth.md` Part 1b.
- [x] Review step shows every collected field before final submit
- [x] Progress is saved to the backend as the applicant advances (not frontend-only) — leaving and
      returning resumes at the last-saved step with prior data intact
- [x] Profile photo upload (magic-byte-validated, real Supabase Storage) — `apply.html` had this
      in the design; the wizard didn't implement it until this session
- [x] Two peer references collected in the Background step (name, relationship, email, optional
      phone) — added 2026-08-31 per client feedback, not in the original `apply.html` design;
      exactly 2 required to submit
- [x] WhatsApp / phone number is required (2026-11-01 — it was optional only because the
      `apply.html` prototype labelled it so); 6–15 digits, checked on the Identity step and at submit
- [x] Founding-cohort pre-launch (`SITE_LAUNCHED=false`, set on both frontend and backend): the
      peer references section is hidden and not required to submit (2026-11-01)
- [x] Overall years of experience is pre-filled from the roles (earliest start → today, whole
      years) when empty, tagged "Calculated from your roles", until the applicant types their own
- [x] Moving Back through the wizard never blocks a save: drafts keep half-filled work /
      education / reference cards, and completeness is enforced at submit (2026-11-01)
- [x] Membership plan is annual-only — the monthly toggle was removed 2026-08-31 per client
      feedback (`BillingPeriod` is now a single-value `'annual'` union end to end)

### US-03-03: Checking my application status
As an applicant, I want to see my current status so I know whether to expect a decision.
- [x] `GET /v1/applications/me` 🔒 returns current status
      (`draft`/`submitted`/`under_review`/`approved`/`rejected`)
- [ ] Payment step after approval is **explicitly deferred** per `docs/rest-api.md`'s
      "not built yet" section — don't assume it exists

---

## US-04 — Member Activation ✅

### US-04-01: Becoming a member after approval
As an approved applicant, I want my account role to change to `member` and gain access to the
member portal.
- [x] Role transition happens server-side on admin approval (`PATCH /v1/admin/applications/:id`,
      backend-only — no admin UI exists to trigger this yet, see the spec doc §7), never
      client-writable

---

## US-05 — Member Dashboard ✅

### US-05-01: Viewing my dashboard
As a member, I want a single landing page summarizing my activity so I don't have to hunt across
pages.
- [x] `/dashboard` route, gated to authenticated users by middleware and restricted to members by the page
- [ ] Per `docs/roadmap.md`: no dedicated dashboard endpoint exists — widgets compose from each
      feature's own list endpoint. The "activity stats"/"your contributions" widget shape is
      **flagged, not decided** — don't invent a shape for it without a product decision
- Implemented dashboard composes existing profile, consultations, own articles, published articles,
  member directory, and upcoming events endpoints. Activity cards show literal consultation and
  article-status counts only; reach, referral goals, billing, and personal schedule widgets remain
  deferred until their contracts and product behavior exist. Includes loading, empty, and
  independent section-error states.

---

## US-06 — Member Profile & Directory ✅

### US-06-01: My public profile after activation
As a member, I want my profile (headline, bio, firm, experience, services, credentials, etc.)
visible in the directory once I'm activated.
- [ ] `GET /v1/members/:slug` returns full profile including all child tables (work experience,
      education, engagements, qualifications, credentials, testimonials, awards, key clients)

### US-06-02: Proposing an edit to my profile
As a member, I want to update my profile so it stays accurate, understanding that some changes
need admin verification before going live.
- [ ] Edits are submitted per-section (`headline_bio`, `contact`, `engagements`, `education`,
      `workExperiences`, `keyClients`, `testimonials`, `awards`), not as one whole-profile write
- [ ] Fact-asserting sections (`engagements`, `testimonials`, `awards`) require per-item proof
      (file or URL) before submission
- [ ] Plain-field sections (`headline_bio`, `contact`) don't require proof but still route through
      the same pending-approval flow
- [ ] Pending edits are visibly badged as pending on the member's own view, not silently applied

### US-06-03: Uploading credential proof
As a member, I want to attach a document or link as proof for a claim so my edit can be verified.
- [ ] `POST /v1/members/:id/uploads` 🔒, MIME-type validated via magic bytes (`file-type`), not by
      file extension

---

## US-07 — Writing and Publishing Articles ✅

### US-07-01: Creating and submitting an article
As a member, I want to write and submit an article so I can build visibility and credibility.
- [x] `POST /v1/articles` 🔒 member; body sanitized with `sanitize-html` before storage; `status`
      resolves to `published` or `pending_review` server-side per `ARTICLES_REVIEW_MODE` (never a
      client choice) — see US-10-02 for the review side
- [x] `GET /v1/articles/me` 🔒 lists the author's own articles regardless of status; backs the
      `/articles` page's "My Articles" tab (member/admin only)
- [x] Frontend write flow at `/articles/write` (`WriteArticleFlow`), reached from a "Write an
      Article" button in the `/articles` page's tab row (member/admin only) — matches
      `design/static_html/articles.html`'s write-flow prototype step-for-step: choose a path
      ("Write it yourself" / "Let GrowXQ AI draft it") → that path's form → a shared live
      preview of exactly how the article will render → submit → success.
- [x] Practice area(s) and countries are both genuinely multi-select (`MultiSelect`, searchable +
      removable chips); cover image is auto-picked via a live Unsplash search keyed by practice
      area, with a "shuffle" button; title suggestions are a real AI call
      (`POST /v1/articles/suggest-topics`); suggested tags are shown during writing but never
      persisted (cosmetic only, matching the prototype's own tags-are-UI-only behavior).
- [x] Article content is authored in a real rich text editor (Tiptap —
      `RichTextEditor`), not a plain textarea: bold, italic, underline, bullet/numbered lists,
      blockquote, inline code, code block, and links. Matches the reference GrowXQ repo's own
      editor choice; kept in lockstep with `ArticlesService`'s `sanitize-html` allowlist (no
      headings/images/tables in either).
- [x] AI-drafting path: a 3-step wizard (tell us about it; adaptive follow-ups, skipped when the
      brief is already specific enough; finishing touches) collects notes/recent
      developments/advice, uploaded source documents (PDF/DOCX/TXT, parsed server-side, never
      persisted), links (fetched server-side with SSRF guards), tone, and extra instructions — no
      title/practice-area/country/state input. `POST /v1/articles/ai-draft` (multipart) generates
      `{title, body}` via the backend's fixed `AI_PROVIDER`/`AI_MODEL`, plus AI-inferred
      `serviceIds`/`countries`/`state`: the model picks only from the real active services and
      countries lists given alongside the brief, validated server-side against those same lists
      (never trusted to self-report valid ids). The draft-review screen shows the inferred
      title/body alongside editable `MultiSelect`/`Input` fields (pre-filled from the response) so
      the member can correct anything before continuing — same components step 1 used to host. An
      inline "refine" box (`POST /v1/articles/ai-refine`) can re-prompt the draft before
      continuing; it never re-infers the taxonomy, only `title`/`body` change. Nothing is
      auto-published from a generated draft — the member always continues through the same shared
      preview step.

### US-07-02: Editing or withdrawing my article
As a member, I want to edit or delete my own article before or after publication.
- [x] `PATCH /v1/articles/:id` and `DELETE /v1/articles/:id` 🔒, scoped to the article's own author
- [x] Resubmitting a `rejected` article (editorial mode) clears its `rejectionReason` and goes
      back through the same review-mode resolution as a first submission

---

## US-08 — Admin: Application Review ✅

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

---

## US-09 — Admin: Member Management ✅

### US-09-01: Reviewing a pending profile-edit request
As an admin with `manageMembers` permission, I want to see pending member profile edits and
approve or reject each one, with its proof, before it goes live.
- [x] `GET /v1/admin/member-edits` and `PATCH /v1/admin/member-edits/:id` per `docs/rest-api.md`,
      plus `GET /v1/admin/members/:id/edits` for the per-member review page
- [x] Queue is grouped **per member** (`/admin/member-edits`): sections changed, pending count,
      waiting-since; clicking through shows every change that member submitted
      (`/admin/member-edits/[memberId]`)
- [x] Each pending section shows **current vs proposed** — field-by-field for headline/bio and
      contact, per-entry Added / Changed / Removed / Unchanged for list sections — with its proof
      (private files via short-lived signed links)
- [x] Approve or reject per section, plus "Approve all" (with confirmation)
- [x] Rejection doesn't silently discard the member's proposed change without a visible reason —
      a reason is required (API-enforced) and shown to the member on their own profile
- [x] At most one pending edit per member + section — resubmitting replaces the older one
- [x] Approved key-client logos are actually published (copied to the public bucket)

**Renewal thresholds are not admin-configurable.** An earlier version of this story had a
`GET`/`PATCH /v1/admin/renewal-policy` pair backing a sitewide settings row (12-month period,
30-day due-soon window). Removed: nothing consumed a non-default value, no automation (reminder
email, auto-suspension) acted on the computed due-state, and no one had asked to change the
numbers — a settings table + admin API for two constants was speculative flexibility with no
current use. The 12/30 values are now hardcoded in
`apps/backend/src/members/members.service.ts`. Actual renewal **payment** flow is still not
built — see `docs/master-tdd.md` Section 8.4.

---

## US-10 — Admin: Article Review ✅

### US-10-02: Reviewing and deciding on a submitted article
As an admin with `manageArticles` permission, I want to review an article submitted for
editorial review and approve or reject it.
- [x] Only reachable when `ARTICLES_REVIEW_MODE=editorial` — the default `instant` mode publishes
      on submit and this queue stays permanently empty, by design
- [x] `GET /v1/admin/articles` / `PATCH /v1/admin/articles/:id`, gated by
      `@RequirePermission('manageArticles')` — same guard chain as `manageApplications`
- [x] Rejecting requires a reason; it's visible to the author via `GET /v1/articles/me` and shown
      on their "My Articles" tab

### US-10-03: Seeing how an AI-written article was generated
As an admin with `manageArticles` permission, I want to see exactly what a member gave GrowXQ
AI when drafting an article and what the AI wrote back, so I can judge an article's provenance and
the AI's output quality.
- [x] `GET /v1/admin/ai-generations` / `GET /v1/admin/ai-generations/:id`, gated by
      `@RequiresPermission('manageArticles')` — read-only, no actions
- [x] `/admin/ai-generations` lists every ai-draft attempt (newest first, 200 most recent) with
      member, draft title, model, date, success/failed status and the article it was saved as;
      filter by All / Saved as article / Generated / Failed, search by member or title
- [x] Detail page shows every wizard input — the three core answers, each follow-up question
      with its answer or "Skipped", source links, uploaded documents (short-lived download links),
      tone, include-a-table toggle, extra instructions — next to the AI's output: title, body,
      inferred services/countries/state and cited sources; a failed attempt shows its error
- [x] An article saved from an AI draft links to its generation (`articles.ai_generation_id`,
      set from the ai-draft response's `generationId`); the review queue shows a "Written with
      AI — view inputs" link on those rows
- [x] Empty, no-matches, not-found and failed-generation states handled; checked at 375px and
      1440px
- [ ] Not covered: `ai-refine` passes and the member's manual edits before saving aren't logged,
      so the output shown is the original draft — the linked article is the saved version

### US-10-01: Managing admin permissions
As a `super_admin`, I want to assign sub-tier roles (`content_manager`, `reviewer`) to other
admins so responsibilities are properly scoped.
- [ ] Gated by `manageAdmins`, held only by `super_admin`
- [ ] An admin with no `admin_role` set is treated as `super_admin` for backward compatibility
      (see `apps/backend/src/auth/constants/admin-permissions.ts`) — new admins should always get
      an explicit role

---

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
- [x] `PATCH /v1/consultations/:id` 🔒 owner-member only (no cancel, no admin override on this
      route — admin uses the separate `PATCH /v1/admin/consultations/:id`, same transition rules);
      states are `pending` → `completed`/`declined`, no intermediate state
- Not built: the inbox page itself (`consultation-requests.html`) — separate frontend session

### US-11-03: Tracking requests I've sent
As a client or member, I want to see the status of consultation requests I've sent.
- [x] `GET /v1/consultations/mine` 🔒 owner (the requester)
- Not built: the sent-requests page itself (`my-consultations.html`) — separate frontend session

---

## US-12 — Peer Connect 🧱

### US-12-01: Setting my monthly matching preferences
As a member, I want to optionally set service/country/hours preferences for this cycle's
peer match.
- [ ] Preferences are optional and skippable
- [ ] This is **not** a member-search/connect directory — no self-serve "pick your own peer" flow

### US-12-02: Receiving and meeting my monthly match
As a member, I want to be matched with one peer per cycle, see a short AI-generated blurb about
them, and meet at a fixed (but reschedulable-by-day) time slot.
- [ ] Lifecycle: `pref → matching → reveal → meeting → post`
- [ ] Reschedule flow offers up to 3 candidate days, requires both parties to accept
- [ ] Time-of-day is fixed platform-wide; only the day is reschedulable

### US-12-03: Reviewing my past match
As a member, I want to see the AI transcript/action items from a past match, plus add a private
note and rating that my matched peer never sees.
- [ ] Notes/ratings are strictly private per-user, never shown to the matched peer
- [ ] This entire feature has **zero real persistence in the design prototype** — treat it as
      designed fresh, not reverse-engineered, per `docs/roadmap.md`

---

## US-13 — Events ⚠️ Browsing + direct admin CRUD built, suggestion queue not

### US-13-01: Suggesting an event
As a client or member, I want to suggest an event for the community calendar.
- [ ] Suggestion enters a `pending` queue; admin approves (publishes) or rejects/deletes
- [x] Admin can also directly add-and-publish, bypassing the queue — one soft-hide list, not two
      disconnected pools (don't reproduce that prototype shortcut). Built as `/admin/events`:
      create, edit (including draft ⇄ published), and delete — see `docs/rest-api.md`'s
      Events — admin section.
- [x] A draft can be saved with just title/description/start date, but publishing (new or an
      existing draft) requires organizer, end date, format, category, city, country, and
      registration URL too — enforced server-side (`400` naming every missing field) and mirrored
      client-side as inline per-field errors, not just a generic banner. See `docs/rest-api.md`'s
      "Publish requirements" subsection.
- Not built: `/events`'s "Suggest an event" card is a `mailto:contact@growxq.com` link, not
  a form — there's nowhere to submit a suggestion to yet. The public submission → pending-queue
  half of this story remains deferred.

### US-13-02: Browsing published events
As a guest or user, I want to see upcoming published events.
- [x] `GET /v1/events` 🌐 returns published events only
- [x] "Register" is a UI stub in the design, not a real RSVP flow — don't build registration
      logic without an explicit product decision first (matches `MemberCard`'s disabled Request
      Consultation treatment: a real, styled, disabled button, not a fake link)

---

## US-14 — Perks, Learnings & Templates

### US-14-01: Browsing perks and learnings
As a visitor/client/member, I can discover resources while receiving only content my role permits.
- [x] Public metadata lists and detail for perks, learnings and ordered collections.
- [x] Guests receive no offer secrets or video URLs. Clients receive only their live, unexpired
      perk tier and explicit-open/first-playlist-video access. Members get member-tier offers
      (falling back to the client tier when a perk has no member offer, so a member never sees
      less than a client) and all active videos. No nested-collection bypass.
- [x] Guests can browse perk cards and the video library, but opening a perk or a video shows a
      sign-in prompt instead of details, offers, links or playback.
- [x] Coming-soon/expired offers, inactive resources and members-only videos are withheld.
- [x] Own-copy thumbnails avoid disclosing locked YouTube IDs.
- [x] No redemption/download/progress/completion tracking added speculatively.
- [x] Perks/Learnings pages and admin management page built from the teammate references,
      adapted to the current GrowXQ theme.

### US-14-03: Templates (added 2026-10-30)
As a member, I can download professional starter templates; others can browse them.
- [x] 12 real starter files (Word/Excel/PowerPoint) seeded, with working formulas in the
      workbooks, plus 3 template kits.
- [x] Every template is members-only: guests see a sign-in prompt, clients a membership prompt.
- [x] Downloads are 60-second signed links for one file; the stored path is never exposed to
      non-admins; the member role is re-checked in the database on every download.
- [x] Admins upload files (type sniffed from bytes, ≤15MB) and manage templates and kits.
- [x] `/templates` page (kits, categories, search; guest sign-in gate, client membership prompt,
      member download), admin Templates tab (upload → save → delete) and sidebar links. Checked
      in a browser as guest (375px + 1440px), client, member (real download) and admin.

### US-14-02: Admin managing resources
As an admin with manageResources permission, I can manage products, videos, playlists and stacks.
- [x] Fresh active admin role and manageResources on every admin route.
- [x] Create/read/edit/delete resources and collections; itemIds replaces membership/order atomically.
- [x] Validate referenced IDs, kind, duplicate IDs, URLs, nulls, and redeemable offers; no dead links.
- [x] Deleted perk/video references are pruned by the existing DB trigger.
- [x] Shared contracts, database docs, REST docs and role-organized Postman requests.
- [x] Verified once in dev (2026-10-29/30) across guest/client/member/admin, including raw-table
      denial and reviewer/stale-admin rejection. The one-off test scripts were removed afterwards.
- [x] Responsive browser QA at 375px and desktop: search/empty states, comparison, details,
      playlist playback and queue, guest/client/member gates, admin creation/editing/validation
      and playlist reordering. Inactive QA fixtures removed; seeded content preserved.

---

## US-15 — Newsletter & Signup Source 📋

### US-15-01: Subscribing to the newsletter
As a visitor, I want to subscribe with just my email, unrelated to creating an account.
- [ ] `POST /v1/newsletter-subscriptions` 🌐; admin `GET` list

### US-15-02: Tracking how a user found GrowXQ
As an admin, I want to see how each user found/joined the platform.
- [ ] Likely an additive `source` column on `profiles`, not a new resource — confirm before adding
      a table

---

## US-16 — Notifications 🔭

### US-16-01: Being notified of activity relevant to me
As a user, I want to be notified (in-app and/or email) when something needs my attention: a new
consultation request, a request completed/declined, a Peer Connect match revealed, a reschedule
proposed/accepted/declined, my profile edit approved/rejected, my application status changing, or
my article/event moderation outcome.
- [ ] Not scoped in `docs/roadmap.md` — every trigger point above exists in the design copy with no
      system behind it yet
- [ ] Recommend building only once at least two triggering features are live, so the design isn't
      built against zero real trigger points (`docs/master-tdd.md` Section 8.1)

---

## US-17 — Admin/Ops Overview Dashboard 🔭

### US-17-01: Seeing all pending queues at a glance
As an admin with `viewDashboard` permission, I want a single landing page showing queue counts
across applications, member edits, articles, events, and consultations, instead of checking each
moderation surface separately.
- [ ] `viewDashboard` permission already exists in `admin-permissions.ts` and is held by every
      admin sub-tier — this story just needs the surface built
- [ ] Worth deferring until events/consultations exist, so there's more than two real queues to
      summarize (`docs/master-tdd.md` Section 8.2)

---

## US-18 — Search & Discovery ⚠️ Built, mobile layout not yet verified

### US-18-01: Searching across members, articles, and events at once
As a signed-in user, I want to ask one question in plain language and get matching members,
articles, and events together, with a short answer explaining the best matches.
(Validated against what was built — the earlier draft's "aggregation layer, full-text only, no
embeddings" premise was superseded; see `docs/rest-api.md` "AI search".)
- [x] One endpoint, `POST /v1/search`, covers all three types; an optional `scope` narrows it to
      one (the articles/events pages search their own type)
- [x] Signed-in users only; a guest gets `401` and the search modal offers "Sign in to search"
- [x] Matches on meaning (embeddings), words (full-text `tsvector`) and names (trigram) over one
      `search_documents` index, kept current by the background worker from DB-trigger events
- [x] An AI planner turns the question into typed filters (types, countries, city, practice area,
      dates, max hourly rate, count); the AI never writes SQL
- [x] An AI judge re-scores candidates, drops weak ones, and gives each a one-line reason shown
      under the result; the short answer above the results is composed from the shown results
      only (never names a result that isn't listed, never shows internal numbers); if no filter
      combination matches, soft filters are relaxed one at a time and the answer says so
- [x] The search boxes (home panel, articles hero, events hero) are typed into in place; pressing
      Enter / the button opens the results modal running that question (an empty box does nothing)
- [x] If an OpenAI step fails, search still answers (keyword/filter results) and flags it in
      `degraded` instead of erroring
- [x] Emails and phone numbers never reach OpenAI or the response (redaction on card text and on
      the outgoing response)
- [x] Rate limited per user (10/min, 100/hour; feedback 30/min) with `429` + `retryAfterSeconds`
- [x] Thumbs up/down feedback on an answer, scoped to the asker's own log entry
- [ ] Search modal checked at 375px and 1440px (root `CLAUDE.md` Code Quality Bar)
