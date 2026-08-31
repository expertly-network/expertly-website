# Expertly — Build Prompts

One prompt per session. Paste a prompt's contents as the **first message of a fresh Claude Code
session** (not a continuation of an existing one — each is meant to start cold, per `CLAUDE.md`'s
own backend/frontend session-split rule). Work through them **in order** — later sessions assume
earlier ones exist (e.g. Consultations needs a real `member_id` to request against, so it comes
after Member Directory).

## How each prompt is built

Every prompt tells the session to **read the relevant `design/static_html/*.html` file(s) itself,
in full** — this file doesn't try to replace that reading, it gives the session what you and I
already worked out across earlier sessions (schema decisions, cross-cutting open questions, which
tables already exist) so it doesn't have to re-derive that too. A prompt that skips straight to
"build X" without the session reading the design first is doing it wrong — don't shortcut that
step even under time pressure.

Backend prompts end with **"verify standalone via curl/REST client, no frontend needed"** —
that's load-bearing, not filler; don't let a session skip it.

Each prompt ends with an **Acceptance criteria** checklist. A session isn't done until every box
is actually true, not just claimed — the session should show you the verification (curl output,
a browser screenshot/description, a passing typecheck), not just assert it passed.

---

## 0. Already done — don't rebuild these

- Auth (Supabase direct, `docs/auth.md`)
- Membership applications — backend + frontend (`docs/rest-api.md`, `apps/frontend/app/apply/`)
- Articles — **backend only**, no frontend yet (see session 2 below)
- Services/categories taxonomy (`docs/database-erd.md`)
- Peer Connect — **schema only** (`supabase/migrations/0001_extensions.sql`–`0004_tables.sql`), no API/frontend
  yet (see sessions 12-13)
- Shared frontend design system: `docs/design-system.md`, `apps/frontend/components/ui/`

---

## 1. Real homepage (frontend only)

```
Build the real Expertly homepage, replacing the current placeholder
(apps/frontend/app/page.tsx currently just renders BackendConnectivityCheck — a dev scaffold, not
the real page; remove it once this is live).

Read design/static_html/index.html and its assets in full before writing any code — layout, copy,
every section (hero, stats, featured members/articles if present, newsletter capture, etc).

This is a public marketing page — no auth gate. Use apps/frontend/components/ui/ primitives
(Button, Card, Badge) and docs/design-system.md's tokens throughout; do not hardcode colors or
introduce new inline Tailwind patterns that duplicate what those primitives already cover. If the
page needs a genuinely new recurring visual pattern, add it to design-system.md/components/ui/ in
the same change, per that doc's own rule.

If the homepage references dynamic data that doesn't have a backend yet (e.g. a "featured
members" section pulling from the not-yet-built Member Directory), use static/placeholder content
for that section and note it as a follow-up — don't block the whole page on unbuilt backend work,
and don't invent a fake API call.

Acceptance criteria:
- [ ] Matches design/static_html/index.html's layout and copy (or documents deliberate deviations
      the way earlier sessions did, e.g. articles' "Design decisions" section in database-erd.md)
- [ ] No hardcoded colors/sizes — uses design-system.md tokens and components/ui/ primitives
- [ ] Responsive at mobile/tablet/desktop widths (check in an actual browser, not just code review)
- [ ] BackendConnectivityCheck and its component file removed
- [ ] pnpm typecheck passes
```

---

## 2. Articles frontend (backend already exists)

```
Build the frontend for the Articles feature. The backend is already live — read
docs/rest-api.md's Articles section and packages/shared-types/article.ts for the fixed contract;
implement against it as given, don't modify it. If the UI genuinely needs a field the contract
doesn't have, stop and flag that explicitly rather than patching around it.

Read design/static_html/articles.html (browse grid + write flow) and article.html (detail page) in
full. Per docs/database-erd.md's Articles section, some prototype behavior is deliberately NOT
reproduced (no draft/pending moderation queue, full-body reads require sign-in even though the
prototype's JS doesn't gate it, AI-summary/tags are not real fields) — build against what the
contract actually returns, not what the static HTML implies.

Pages needed: /articles (browse, public), /articles/[id] (detail, signed-in only — redirect to
login otherwise), a write/edit flow (member or admin only), and "my articles" (owner's own list
regardless of status, uses GET /v1/articles/me).

Use apps/frontend/components/ui/ primitives throughout. Add "Articles" to TopNav's nav links now
that the page exists (see TopNav.tsx's own comment about adding links as pages ship).

Acceptance criteria:
- [ ] Browse grid works signed-out (GET /v1/articles, published only, no body)
- [ ] Detail page redirects unauthenticated users to /login?returnTo=...
- [ ] Write flow only reachable by member/admin roles; client role redirected away
- [ ] Draft/published toggle works for the owner (or admin) via PATCH
- [ ] Uses @shared/article types via `import type`, no redefined local copies
- [ ] Uses components/ui/ primitives, no new inline duplicate button/card/input styling
- [ ] TopNav updated with the Articles link
- [ ] Verified in an actual browser: browse (signed out), detail (signed in), write, edit
- [ ] pnpm typecheck passes
```

---

## 3. Real per-role dashboard (frontend only)

```
Replace the placeholder dashboard (apps/frontend/app/dashboard/page.tsx currently just shows a
"coming in a future iteration" message per role) with the real thing — but only for what's
actually built by the time you do this session. Do this LAST among the frontend-only sessions,
after Member Directory, Consultations, and Events at minimum, since the dashboard composes from
those features' own list endpoints rather than having its own endpoint (per docs/roadmap.md's
Member Directory section: "no dedicated endpoint — every widget composes from this section's and
other sections' own list endpoints").

Read design/static_html/dashboard.html AND dashboard-alt-3.html (two visual treatments of the same
requirements, not materially different — reconcile them, don't build both) in full.

Build only the widgets whose backing feature already has a real endpoint at the time you do this
session; for anything still unbuilt, either omit it or keep an honest "coming soon" placeholder
matching the pattern in the current stub — don't fake data for an unbuilt feature.

Acceptance criteria:
- [ ] Renders correctly for all 3 roles (client/member/admin) with role-appropriate widgets
- [ ] Every widget backed by a real endpoint call, no fabricated/mocked data
- [ ] Any not-yet-built widget is an honest placeholder, not invented content
- [ ] Verified in an actual browser as each of the 3 roles
- [ ] pnpm typecheck passes
```

---

## 4. Member Directory & Profiles — backend

```
This is the foundational remaining backend session — several later features (Consultations,
Dashboard, Articles' authorName resolution) depend on a real member_profiles table existing.

Read design/static_html/members.html (directory/search) and member-profile.html (3099 lines —
profile detail + self-edit + consultation-request entry point) in full before designing anything.
Also read docs/database-erd.md's existing "Target member_profiles shape" section (already derived
from a previous read of this same design, not built yet) and docs/roadmap.md's "Member directory &
profiles" section — both are your starting point, not something to re-derive from scratch, but
verify them against the design yourself rather than trusting them blindly.

Two open decisions you must resolve as part of this session (both flagged in docs/roadmap.md's
"Cross-cutting open decisions" — don't guess independently, they're written up there with the
context you need):
1. Member renewal/subscription lifecycle — there is currently NO schema for this at all. Design
   it (expiry tracking, renewal status, the global "valid for N months" + "flag due N days before"
   admin config the prototype shows).
2. Whether member self-edit is a direct write or the per-section pending-approval workflow the
   design actually shows (roadmap.md says the latter is the real design — a genuinely involved
   moderation workflow, comparable in scope to the deferred application-review feature). If that
   full workflow is too large for one session, it's fine to scope this session to read-only
   directory + profile (no self-edit yet) and flag self-edit/moderation as its own follow-up
   session — but make that a deliberate, stated scoping decision, not a silent omission.

Write the schema into a new supabase/migrations/000N_member_profiles.sql (don't touch
supabase/migrations/0001_extensions.sql–0004_tables.sql — that one's done). Update docs/database-erd.md and docs/rest-api.md with
the finalized contract. Write packages/shared-types/member.ts. Implement and verify standalone via
curl/REST client, no frontend needed.

Acceptance criteria:
- [ ] Renewal-lifecycle schema exists and is documented (not deferred silently)
- [ ] Self-edit scope (full moderation workflow vs. read-only-for-now) is an explicit, stated
      decision in docs/database-erd.md, not an accidental gap
- [ ] GET /v1/members (search/filter/sort/paginate) and GET /v1/members/:id implemented
- [ ] packages/shared-types/member.ts written, matches the actual response shape exactly
- [ ] docs/database-erd.md and docs/rest-api.md updated
- [ ] Verified via curl/REST client — list, detail, filter, and pagination all exercised
- [ ] pnpm typecheck passes
```

---

## 5. Member Directory & Profiles — frontend

```
Build the frontend for Member Directory & Profiles. Read docs/rest-api.md's Members section
(written by the prior backend session) and packages/shared-types/member.ts for the fixed
contract — implement against it, don't modify it.

Read design/static_html/members.html and member-profile.html in full. Per that design file's own
"Prototype shortcuts to not reproduce" (documented in docs/roadmap.md): don't use slug-like string
ids, don't derive isOwnProfile from localStorage, don't fake the self-edit pending-state — if the
backend session scoped self-edit as read-only-for-now, this frontend session should too (a
"coming soon" state for edit, not a fake working form).

Pages: /members (directory, public), /members/[id] (full profile, public — matches the design's
own access level). Use components/ui/ primitives throughout.

Acceptance criteria:
- [ ] Directory search/filter/sort/pagination all work against the real endpoint
- [ ] Profile page renders all child data (work experience, education, engagements, etc.)
- [ ] Matches what the backend session actually scoped (no fake self-edit if backend didn't build
      real self-edit)
- [ ] Uses components/ui/ primitives, no new inline duplicate styling
- [ ] Verified in an actual browser: search, filter, a profile page
- [ ] pnpm typecheck passes
```

---

## 6. Consultations — backend

```
Read design/static_html/consultation-requests.html (member's inbox), my-consultations.html
(requester's own sent list — note per docs/roadmap.md this redirects a member-role session to the
inbox page, i.e. genuinely two pages for two roles, not one page with conditional rendering), and
the request-creation flow embedded in member-profile.html, all in full.

One resource per docs/roadmap.md's Consultations section — read that section, it already has the
real field shape confirmed from admin-data.js. Resolve the open question stated there explicitly:
is a consultation request client→member only, or also member→member (peer-to-peer)? Don't guess —
if genuinely ambiguous from the design, state the decision you made and why.

requester_id/member_id should reference profiles(id) (see the consultation_requests table already
in supabase/migrations/0001_extensions.sql–0004_tables.sql — it exists but wasn't wired to a controller/service
yet; you may need to adjust its columns once you've confirmed the real field shape against the
design, don't assume the existing table is already exactly right).

The prototype has NO ownership filter on the inbox view (shows every request to every member) —
your real backend must filter by the authenticated member; don't reproduce that gap.

Implement, update docs/rest-api.md and packages/shared-types/consultation-request.ts, verify
standalone via curl/REST client.

Acceptance criteria:
- [ ] client→member vs. member→member decision is explicit and documented
- [ ] POST /v1/consultations, GET /v1/consultations/mine, GET /v1/consultations/received
      (ownership-filtered, unlike the prototype), PATCH (complete/decline) all implemented
- [ ] docs/rest-api.md and packages/shared-types/consultation-request.ts updated
- [ ] Verified via curl/REST client as both a requester and a receiving member
- [ ] pnpm typecheck passes
```

---

## 7. Consultations — frontend

```
Build the frontend for Consultations against the now-fixed contract in docs/rest-api.md /
packages/shared-types/consultation-request.ts — don't modify it.

Read design/static_html/consultation-requests.html and my-consultations.html in full — build both
as genuinely separate pages/routes per role (per docs/roadmap.md, this is confirmed as two real
pages, not one with conditional rendering), plus the request-creation entry point on the member
profile page (from session 5).

Acceptance criteria:
- [ ] /my-consultations (requester's sent list) and the member-role inbox view both implemented
      as separate routes, not one conditionally-rendered page
- [ ] Request creation reachable from a member's profile page
- [ ] Complete/decline actions work from the member inbox
- [ ] Uses components/ui/ primitives
- [ ] Verified in an actual browser as both a client (sending) and a member (receiving)
- [ ] pnpm typecheck passes
```

---

## 8. Perks, Templates, Learnings — backend

```
Read design/static_html/perks.html, templates.html, and learnings.html in full. Per
docs/roadmap.md: all three are structurally identical (category, title/name, description, plus one
type-specific field each) and simpler than everything else — build one generic CRUD pattern, not
three bespoke ones.

Resolve the one open question stated in docs/roadmap.md before writing the schema: should these be
public or member-gated reads? None of the three pages have an actual in-page auth gate in the
prototype — this is a product call, not something the design settles. State your decision.

Require the link/file URL server-side rather than allowing empty — docs/roadmap.md notes the
prototype's admin forms have no such validation and empty links render as dead buttons; don't
reproduce that.

Three tables (or one polymorphic table if you have a clean way to do that without it becoming
awkward — your call, but justify it), migration, docs/rest-api.md update,
packages/shared-types/{perk,template,learning}.ts, verify standalone via curl/REST client.

Acceptance criteria:
- [ ] Public-vs-member-gated decision is explicit and applied consistently across all 3
- [ ] GET (list) for all 3; admin-only POST/PATCH/DELETE for all 3
- [ ] link/file URL required server-side, not just "required" client-side
- [ ] docs/rest-api.md and shared-types updated
- [ ] Verified via curl/REST client for all 3 resources
- [ ] pnpm typecheck passes
```

---

## 9. Perks, Templates, Learnings — frontend

```
Build the frontend for all 3 against the fixed contract from session 8. Read perks.html,
templates.html, learnings.html in full. Same generic pattern on the frontend as the backend used —
don't hand-build three bespoke page structures if they're genuinely identical in shape.

Acceptance criteria:
- [ ] All 3 list pages implemented, respecting the public-vs-gated decision from session 8
- [ ] Admin CRUD UI for all 3 (if you're also doing admin sessions separately, this can be a
      simple form now and get folded into the admin dashboard later — state which you did)
- [ ] Uses components/ui/ primitives
- [ ] Verified in an actual browser
- [ ] pnpm typecheck passes
```

---

## 10. Events — backend

```
Read design/static_html/events.html and admin-dashboard.html's events panels in full.

Per docs/roadmap.md: events have their own category taxonomy (Tax/Legal/Audit/AI & Tech/Fintech/
Law/Startup/General/International Law/Networking/M&A) — NOT the 12-item services list. There's a
public-suggestion → pending → admin-approve-and-publish flow, plus admin can also directly
add-and-publish, bypassing the queue — one unified table/status model, not the prototype's
two-disconnected-pools version (same pattern articles avoided for its own moderation queue).

A `public.events` table already exists in supabase/migrations/0001_extensions.sql–0004_tables.sql but was
built speculatively before this session did the real design read — verify its columns
(event_type, event_format, status enum, country-as-text, etc.) against what you actually find in
events.html and correct it via a new migration if it doesn't match. Don't assume it's already
right.

"Register" is a UI stub in the prototype, not real — don't build a real RSVP system, just the
button as a stub, same as the design.

Implement, update docs/rest-api.md + shared-types/event.ts, verify standalone via curl/REST client.

Acceptance criteria:
- [ ] events table columns verified/corrected against the actual design (not assumed from the
      speculative version already in supabase/migrations/0001_extensions.sql–0004_tables.sql)
- [ ] Public suggestion → pending → admin approve/reject/publish flow implemented as one unified
      model, not two disconnected pools
- [ ] Admin direct add-and-publish (bypassing the queue) also works
- [ ] GET /v1/events (published only, public) implemented
- [ ] docs/rest-api.md and shared-types/event.ts updated
- [ ] Verified via curl/REST client — suggestion, approval, direct publish, public list
- [ ] pnpm typecheck passes
```

---

## 11. Events — frontend

```
Build the Events frontend against the fixed contract from session 10. Read events.html in full.

Acceptance criteria:
- [ ] Public events list/detail
- [ ] Suggestion submission form (public or signed-in per what session 10 decided)
- [ ] "Register" renders as the same stub the design shows — not a fake working RSVP
- [ ] Uses components/ui/ primitives
- [ ] Verified in an actual browser
- [ ] pnpm typecheck passes
```

---

## 12. Peer Connect — backend API

```
The schema already exists (peer_connect_matches, peer_connect_member_preferences in
supabase/migrations/0001_extensions.sql–0004_tables.sql, designed and reviewed across several earlier
sessions) — this session builds the NestJS controller/service layer on top of it, not new tables.

Read design/static_html/peer-connect.html in full — it's dense (5 lifecycle phases: Set
Preferences → Matching → Meet Your Peer → Meeting Day → Transcript & Feedback), read all of it,
not just the parts that map obviously to the schema.

Explicitly OUT of scope for this session (already decided, see the schema's own migration
comments): the actual matching algorithm, video-call provider integration, AI transcription
pipeline. Build the CRUD/workflow layer around wherever those integrations will eventually plug
in — a stub/manual-trigger for "run matching" is fine, a real matching algorithm is not this
session's job.

Endpoints needed: preferences submission (POST, upserts peer_connect_member_preferences for the
current cycle), GET current match state (for the "Set Preferences"/"Matching"/"Reveal"/"Meeting"/
"Post" state card), reschedule propose/accept/decline (the 3 nullable columns on
peer_connect_matches — see that table's own comments for the state model), past-sessions list
(completed matches with rating/feedback/note — private, own row only), action-items add/remove on
a match (shared, either participant), rating/feedback submission.

cycle_month is a plain date, not FK'd to a cycles table (deliberate — see the migration's own
comment) — the "2nd Tuesday of the month" / preferences-window date math needs to live in one
backend utility function, not be recomputed ad hoc per endpoint.

Verify standalone via curl/REST client, no frontend needed. Update docs/rest-api.md and write
packages/shared-types/peer-connect.ts.

Acceptance criteria:
- [ ] Preferences submission (with the "skip" = no row case) works
- [ ] Match state endpoint correctly reflects the 5-phase lifecycle based on real dates
- [ ] Reschedule propose/accept/decline all work, correctly updating scheduled_date on accept
- [ ] Action items: either participant can add/remove, changes visible to both
- [ ] Rating/feedback/note: private, RLS-enforced (verify a participant genuinely cannot read the
      other's row, not just that the API doesn't return it)
- [ ] Date math (2nd Tuesday, preferences window) lives in one shared utility, not duplicated
- [ ] docs/rest-api.md and shared-types/peer-connect.ts updated
- [ ] Verified via curl/REST client as both participants of a match
- [ ] pnpm typecheck passes
```

---

## 13. Peer Connect — frontend

```
Build the Peer Connect frontend against the fixed contract from session 12. Read
design/static_html/peer-connect.html in full — the phase-rail UI, the 24-hour availability
timeline on the preferences form, the reschedule propose/accept flow, and the past-sessions
accordion are all real, detailed interactions worth reading closely rather than skimming.

Member-only page (see the design's own top-of-file redirect logic for non-members).

Acceptance criteria:
- [ ] All 5 lifecycle phases render correctly based on real backend state
- [ ] Preferences form (practice area, location, hours range) submits correctly, skip works
- [ ] Reschedule propose (as the requester) and accept (as the peer) both work
- [ ] Past-sessions list shows real completed matches with working rating/feedback/note
- [ ] Non-members redirected before the page renders
- [ ] Uses components/ui/ primitives
- [ ] Verified in an actual browser through a full cycle if possible (or as much of it as backend
      state allows)
- [ ] pnpm typecheck passes
```

---

## 14. Admin — backend

```
Read design/static_html/admin-login.html and admin-dashboard.html (all panels — member
management, application review, article/event moderation, the team-management panel itself) in
full, plus assets/admin-data.js for the real data shapes it already uses.

Resolve docs/roadmap.md's first cross-cutting open decision before building anything: flat `admin`
role (current schema) vs. a real sub-tier system (super_admin/content_manager/reviewer, which the
prototype's admin-data.js actually models with real gated forms). This affects every admin action
below — decide once, don't let each endpoint guess independently.

This session is large — it's reasonable to split it further (e.g. application review + member
approval as one session, content moderation as another) once you're in it and can see the real
size. State how you split it if you do.

Verify standalone via curl/REST client. Update docs/rest-api.md.

Acceptance criteria:
- [ ] Admin sub-tier decision made explicitly and documented, not guessed per-endpoint
- [ ] Application review (approve/reject) implemented — this is the actual mechanism that
      provisions a member_profiles row and flips profiles.role to 'member', per
      docs/database-erd.md's long-standing note that this was deferred until now
- [ ] Member management (the renewal/lifecycle admin config from session 4) implemented
- [ ] Content moderation surfaces implemented for whichever areas got real queues (events'
      suggestion queue at minimum)
- [ ] docs/rest-api.md updated
- [ ] Verified via curl/REST client
- [ ] pnpm typecheck passes
```

---

## 15. Admin — frontend

```
Build the admin dashboard frontend against the fixed contract from session 14. Read
admin-login.html and admin-dashboard.html in full.

Acceptance criteria:
- [ ] Admin login flow works and is gated correctly (admin role only)
- [ ] Application review UI works end-to-end (approve flips the applicant to a real member)
- [ ] Whatever moderation surfaces session 14 built are all reachable and functional
- [ ] Uses components/ui/ primitives
- [ ] Verified in an actual browser as an admin
- [ ] pnpm typecheck passes
```

---

## 16. Smaller/adjacent items (any order, low priority)

```
Three small, independent items from docs/roadmap.md's "Smaller/adjacent items" section — do these
whenever, they don't block anything else:

1. Newsletter subscriptions — plain email-capture, POST /v1/newsletter-subscriptions (public),
   admin GET list. No real account tie-in.
2. Signup-source tracking — a `source` column on profiles (how someone found/joined Expertly),
   surfaced in the admin user directory. Likely just an additive column + admin display, not a
   new resource.
3. Global cross-entity search (index.html's homepage search bar spanning members/articles/events)
   — an aggregate endpoint over already-built resources. Only do this once members/articles/events
   all actually exist.

Read the relevant design sections for each before building. Each is small enough to be its own
quick session or folded into whichever nearby session is most convenient.

Acceptance criteria (per item, check off whichever you did):
- [ ] Newsletter: POST works publicly, admin list works
- [ ] Signup source: column exists, populated on signup, visible in admin view
- [ ] Global search: returns results across all 3 resource types it spans
- [ ] pnpm typecheck passes
```
