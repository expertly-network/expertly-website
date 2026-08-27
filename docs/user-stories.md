# User Stories — Expertly Platform

Status badges match `docs/master-tdd.md`'s conventions: ✅ Built · 🧱 Schema only, no API ·
📋 Roadmap (scoped in `docs/roadmap.md`, nothing built) · 🔭 Beyond-roadmap (sketched, not
committed). A story's acceptance criteria describe the **intended** behavior regardless of status —
for 📋/🔭 stories, treat them as a draft to validate during that feature's own design session, not
a spec to implement verbatim.

Design source for every story is the matching `design/static_html/*.html` page, per root
`CLAUDE.md`'s methodology — check it before implementing, don't design from the story text alone.

---

## US-01 — Guest Experience ✅

### US-01-01: Discovering Expertly for the first time
As a visitor, I want to understand what Expertly is and see credible signals (featured members,
articles, practice areas) so I can decide whether to sign up or apply.
- [ ] Homepage renders without auth, with featured members, latest articles, and practice-area
      marquee sourced from the real APIs (`GET /v1/members`, `GET /v1/articles`, `GET /v1/practice-areas`)
- [ ] No login-walled content is visible in a guest session
- [ ] Primary CTAs ("Apply as a member", client signup) are visible above the fold

### US-01-02: Browsing the member directory as a guest
As a visitor, I want to search and filter vetted experts so I can find someone relevant before
committing to sign up.
- [ ] `GET /v1/members` supports search (name/practice/location/firm/title), filter (practice area,
      country, price-range bucket), sort, and pagination per `docs/rest-api.md`
- [ ] Guest can view a member's full public profile (`GET /v1/members/:id`)
- [ ] No member contact info is exposed without booking a consultation (once that feature exists)

### US-01-03: Reading a published article as a guest
As a visitor, I want to read member-authored articles so I can evaluate the platform's expertise
before signing up.
- [x] `GET /v1/articles` returns only `published` articles to unauthenticated callers
- [x] `GET /v1/articles/:id` 🔑 requires auth for full body per `docs/rest-api.md` — guest sees list
      + excerpt only, not full body, unless that's since changed in the contract (frontend:
      `/articles/[id]` fetches the public list and shows a title+excerpt preview for guests,
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
- [x] LinkedIn import step pre-fills identity/background where available (real fetch against a
      `LinkedInImportProvider`, mocked for now — see the spec doc §5) — imported fields are
      visually tagged and the tag clears the moment the applicant edits that field
- [x] Review step shows every collected field before final submit
- [x] Progress is saved to the backend as the applicant advances (not frontend-only) — leaving and
      returning resumes at the last-saved step with prior data intact
- [x] Profile photo upload (magic-byte-validated, real Supabase Storage) — `apply.html` had this
      in the design; the wizard didn't implement it until this session

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
- [ ] `/dashboard` route, gated to authenticated users by middleware
- [ ] Per `docs/roadmap.md`: no dedicated dashboard endpoint exists — widgets compose from each
      feature's own list endpoint. The "activity stats"/"your contributions" widget shape is
      **flagged, not decided** — don't invent a shape for it without a product decision

---

## US-06 — Member Profile & Directory ✅

### US-06-01: My public profile after activation
As a member, I want my profile (headline, bio, firm, experience, services, credentials, etc.)
visible in the directory once I'm activated.
- [ ] `GET /v1/members/:id` returns full profile including all child tables (work experience,
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
- [x] `POST /v1/articles` 🔒 member; body sanitized with `sanitize-html` before storage
- [x] `GET /v1/articles/mine` 🔒 lists the author's own articles regardless of status
- [ ] No frontend "Write an Article" authoring UI exists yet — these are API-level criteria only;
      the prototype's write flow (incl. its AI-drafting path) is a separate, later feature

### US-07-02: Editing or withdrawing my article
As a member, I want to edit or delete my own article before or after publication.
- [x] `PATCH /v1/articles/:id` and `DELETE /v1/articles/:id` 🔒, scoped to the article's own author
- [x] AI-assisted article generation is **explicitly deferred** per `docs/rest-api.md` — don't
      assume an AI-generation endpoint exists

---

## US-08 — Admin: Application Review ✅

### US-08-01: Reviewing and deciding on an application
As an admin with `manageApplications` permission, I want to review a submitted application and
approve, reject, or waitlist it.
- [ ] Gated by `@RequirePermission('manageApplications')`, not a bare `admin` role check — a
      `reviewer` sub-tier has exactly this permission and nothing else destructive
- [ ] Approval triggers the role transition described in US-04-01

---

## US-09 — Admin: Member Management ✅

### US-09-01: Reviewing a pending profile-edit request
As an admin with `manageMembers` permission, I want to see pending member profile edits and
approve or reject each one, with its proof, before it goes live.
- [ ] `GET /v1/admin/member-edits` and `PATCH /v1/admin/member-edits/:id` per `docs/rest-api.md`
- [ ] Rejection doesn't silently discard the member's proposed change without a visible reason

### US-09-02: Configuring the membership renewal policy
As an admin with `manageMembers` permission, I want to set how long membership is valid and when
to flag it as due-soon.
- [ ] `GET`/`PATCH /v1/admin/renewal-policy` — global config, not per-member
- [ ] Actual renewal **payment** flow is not built — this only sets thresholds, per
      `docs/roadmap.md`'s open-decision note (now schema'd, payment still open — see
      `docs/master-tdd.md` Section 8.4)

---

## US-10 — Admin: Article Review ✅

### US-10-01: Managing admin permissions
As a `super_admin`, I want to assign sub-tier roles (`content_manager`, `reviewer`) to other
admins so responsibilities are properly scoped.
- [ ] Gated by `manageAdmins`, held only by `super_admin`
- [ ] An admin with no `admin_role` set is treated as `super_admin` for backward compatibility
      (see `apps/backend/src/auth/constants/admin-permissions.ts`) — new admins should always get
      an explicit role

---

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

---

## US-12 — Peer Connect 🧱

### US-12-01: Setting my monthly matching preferences
As a member, I want to optionally set practice-area/country/hours preferences for this cycle's
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

## US-13 — Events ⚠️ Browsing built, suggestion queue not

### US-13-01: Suggesting an event
As a client or member, I want to suggest an event for the community calendar.
- [ ] Suggestion enters a `pending` queue; admin approves (publishes) or rejects/deletes
- [ ] Admin can also directly add-and-publish, bypassing the queue — one soft-hide list, not two
      disconnected pools (don't reproduce that prototype shortcut)
- Not built: `/events`'s "Suggest an event" card is a `mailto:contact@expertly.global` link, not
  a form — there's nowhere to submit a suggestion to yet.

### US-13-02: Browsing published events
As a guest or user, I want to see upcoming published events.
- [x] `GET /v1/events` 🌐 returns published events only
- [x] "Register" is a UI stub in the design, not a real RSVP flow — don't build registration
      logic without an explicit product decision first (matches `MemberCard`'s disabled Request
      Consultation treatment: a real, styled, disabled button, not a fake link)

---

## US-14 — Perks, Templates, Learnings 📋

### US-14-01: Browsing perks/templates/learnings
As a member (or possibly guest — public-vs-gated is an open product call per
`docs/roadmap.md`), I want to browse discounts, downloadable templates, and learning resources.
- [ ] All three resources share one CRUD shape; no member-facing submission for any of them
- [ ] No redemption/download/completion tracking exists in the design — don't add it speculatively

### US-14-02: Admin managing perks/templates/learnings
As an admin with `manageResources` permission, I want to add/edit/remove perks, templates, and
learnings.
- [ ] Link/file URL is required server-side — the prototype's admin forms allow empty links that
      render as dead buttons; don't reproduce that

---

## US-15 — Newsletter & Signup Source 📋

### US-15-01: Subscribing to the newsletter
As a visitor, I want to subscribe with just my email, unrelated to creating an account.
- [ ] `POST /v1/newsletter-subscriptions` 🌐; admin `GET` list

### US-15-02: Tracking how a user found Expertly
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

## US-18 — Search & Discovery 🔭

### US-18-01: Searching across members, articles, and events at once
As a visitor or user, I want one search bar on the homepage that searches members, articles, and
events together.
- [ ] This is an aggregation layer over each resource's existing search/filter endpoints, not a
      new data model
- [ ] Full-text search (Postgres `tsvector`) is sufficient at current data volume — do not add
      vector/embedding columns or call an embedding API for this; that's a separate, uncommitted
      decision (`docs/master-tdd.md` Section 8.3)
