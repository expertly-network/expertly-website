# Expertly — REST API roadmap

**Status: planning only.** Nothing in this document is built or is a "fixed contract" the way
`docs/rest-api.md`/`docs/database-erd.md` are — those two remain the source of truth for what
actually exists. This doc is a scoping inventory, derived by reading every remaining page in
`design/static_html/` (the same "read thoroughly, derive the real model, flag prototype shortcuts"
methodology `CLAUDE.md` uses for a real backend session), so that picking the next feature to build
starts from an accurate map instead of a blank page.

Nothing here should be implemented as-is — each section still needs its own backend session (read
the design fresh, derive the real schema, write it into `rest-api.md`/`database-erd.md`, resolve
open questions with whoever's driving) exactly like membership applications and articles were.

## Already built

| Feature | Endpoints | Docs |
|---|---|---|
| Auth | — (Supabase direct, no custom REST) | `docs/auth.md` |
| Membership applications | `POST /v1/applications`, `GET /v1/applications/me` | `docs/rest-api.md` |
| Practice areas | `GET /v1/practice-areas` | `docs/rest-api.md` |
| Articles | `GET /v1/articles`, `GET /v1/articles/mine`, `GET/:id`, `POST`, `PATCH/:id`, `DELETE/:id` | `docs/rest-api.md` |

## Cross-cutting open decisions

Worth resolving **before** several of the sections below get built for real, since they each affect
more than one feature:

1. **Admin sub-tier permissions.** The prototype's admin layer (`assets/admin-data.js`) models three
   real tiers — `super_admin` (everything, incl. managing other admins), `content_manager`
   (write/publish/delete articles & events, review applications, no admin management), `reviewer`
   (approve/reject applications & article submissions only) — with real, separate forms and gated
   actions throughout `admin-dashboard.html`. **The current schema has none of this** —
   `profiles.role` is a flat `admin`. This shows up as a gating question on: article moderation
   (deferred, not built), event-suggestion approval, member profile-edit-request approval,
   consultation oversight, perks/templates/learnings CRUD, and the admin-team-management panel
   itself. Decide once — flat `admin` (what exists today) vs. a real sub-tier system — rather than
   each future session guessing independently.
2. **Member renewal/subscription lifecycle.** `admin-dashboard.html`'s member panel has a **global
   renewal policy config** ("membership valid for N months," "flag due-soon starting N days
   before") and per-member renewal-status tracking. There is currently **no schema for this at
   all** — `membership_applications` only covers the application step, nothing about what happens
   after approval (when does a member's access actually expire, is there a renewal payment flow,
   what happens on lapse). This blocks any real "Member Directory & Profiles" session from being
   complete, since renewal status is shown right next to profile data in the admin view.
3. **File/proof storage.** Member profile self-edit "proof" (file upload or URL, per the section
   being edited) is the first real need for actual file storage in this app — nothing built so far
   uses it (article cover images and template/perk links are all just plain URL strings, no upload).
   Needs a Supabase Storage bucket + upload flow decided before that endpoint can be built.
4. **Notifications.** Multiple flows have explicit "you'll be notified" copy (new consultation
   request, request completed/declined, Peer Connect match revealed, reschedule
   proposed/accepted/declined) with no notification system anywhere in the app yet. Not scoping the
   notification system itself here — just flagging that every section below has at least one
   trigger point that assumes one eventually exists.
5. **In-app messaging: doesn't exist, and nothing here needs it.** Consultations and Peer Connect
   both resolve to `mailto:`/`tel:` links or a fixed meeting slot, never in-app chat. Worth stating
   explicitly so a future session doesn't assume it's implied.

## Member directory & profiles

**Source:** `members.html` (directory/search), `member-profile.html` (3099 lines — profile detail +
self-edit + consultation-request entry point), `dashboard.html`/`dashboard-alt-3.html` (two visual
treatments of the same member dashboard, not materially different requirements).

Largely matches the already-documented (not-yet-built) "Target `member_profiles` shape" in
`docs/database-erd.md` — `headline`, `bio`, `firmName`, `firmWebsite`, `yearsOfExperience`,
`feeRange`, `memberTier`, `isAvailable`/`availabilityNotes`, contact fields, plus the 7 child tables
(`work_experiences`, `educations`, `engagements`, `qualifications`, `credentials`, `testimonials`,
`awards`) and `member_services`. Two refinements the existing doc doesn't have: a `feeCurrency`
field, and `credentials` needs a per-item `isVerified` flag (distinct from `qualifications`, which
is plain name+year — `credentials` are formal and admin-verifiable, with an issuing body).
`keyClients` (name + logo) also showed up in the self-edit config with no populated example in the
seed data — worth confirming it's real before building it.

**Sketch endpoints:**
- `GET /v1/members` 🌐 — directory list: search (name/practice/location/firm/title), filter
  (practice area, country, price-range bucket), sort, pagination.
- `GET /v1/members/:id` 🌐 — full profile incl. all child data. A member's own published articles
  are just `GET /v1/articles?authorId=` (needs that query param added to the existing endpoint,
  not a new one) rather than embedded here.
- `PATCH /v1/members/:id` 🔒 Owner — **not a direct write**. The design's real behavior is a
  per-section proposal (`headline_bio`, `contact`, `engagements`, `education`, `workExperiences`,
  `keyClients`, `testimonials`, `awards`) that goes to `pending`, badged as such, until an admin
  approves it. Sections asserting a factual claim (`engagements`, `testimonials`, `awards`) require
  per-item proof (file/URL — see storage decision above); plain-field sections don't. This is a
  real, fairly involved moderation workflow — comparable in scope to (but more granular than) the
  deferred membership-application review — not a small detail to fold in casually.
- Admin: `GET`/`PATCH` on pending profile-edit requests (approve/reject), separate from the member's
  own `PATCH` above.
- Dashboard: **no dedicated endpoint** — every widget (consultation feed, upcoming events, latest
  articles, directory teaser, profile-completeness) composes from this section's and other
  sections' own list endpoints. The one unclear widget is "activity stats"/"your contributions" —
  flag for product clarification rather than guessing a shape.

**Prototype shortcuts to not reproduce:** slug-like string ids instead of UUIDs; `isOwnProfile`
derived from a `localStorage` session blob; self-edit "overrides" are an in-memory client-side merge
with no real pending-state persistence (the *workflow* is real and worth keeping, the storage
mechanism is entirely fake).

## Consultations

**Source:** `consultation-requests.html` (member's inbox of requests received), `my-consultations.html`
(requester's own sent requests — redirects a `member`-role session to the inbox page instead, i.e.
these are genuinely two different pages for two roles viewing the same data, not one page with
conditional rendering), plus the request-creation flow embedded in `member-profile.html`.

**One resource** (confirmed via `admin-data.js`'s own comment that both pages read the same
canonical record):
```
id, requesterName, requesterEmail, requesterContactEmail, requesterPhone, requesterFirm,
memberId, memberName, memberFirm, memberAvatar, memberPractice,
message, sentAt, status: 'pending' | 'completed' | 'declined'
```
Creation only collects `name, email, phone, message` — no topic/practice-area picker, no
time-slot scheduling, no urgency/budget field, no rate/payment. `requesterFirm` being present
implies the requester can themselves be a verified member (peer-to-peer request) — worth an
explicit decision on whether consultation requests are client→member only, or also member→member
(which would overlap with Peer Connect below).

**Sketch endpoints:**
- `POST /v1/consultations` 🔑 Auth — create a request to a given member.
- `GET /v1/consultations/mine` 🔒 Owner — caller's own sent requests.
- `GET /v1/consultations/received` — 🔒, scoped to `memberId === caller.id`. **The prototype has no
  ownership filter here at all** (`consultation-requests.html` shows every request to every member)
  — a real backend must filter by the authenticated member, not reproduce that.
- `PATCH /v1/consultations/:id` — 🔒 Owner (the target member) or admin — mark
  `completed`/`declined`. No intermediate `accepted`/`in-progress` state, no cancel action.
- Admin oversight: `GET /v1/consultations` (all), same `PATCH` override.

No in-app messaging (contact resolves to `mailto:`/`tel:`). Notification triggers to account for:
new request received, request completed/declined.

## Peer Connect — recommend its own dedicated scoping session

**This is not a member-search/connect directory** despite the name — it's an automated **monthly
1:1 peer-matching program**: every member gets matched with exactly one other member per cycle (by
practice area + location + preferred hours), given a fixed meeting slot (day is reschedulable
within a window, time is fixed platform-wide), with the call AI-transcribed and action items
auto-extracted afterward. It's **member-only** — the page redirects non-members away before render,
and has no admin view found on it (admin oversight, if any, would live elsewhere in
`admin-dashboard.html`, not confirmed).

Entities implied: monthly **preferences** (practice areas, countries, hours window — optional,
skippable), a **match** per member per cycle (peer id, AI blurb, meeting date, a 5-phase lifecycle
`pref → matching → reveal → meeting → post`), a **reschedule request** (up to 3 candidate days,
two-party accept/decline), a **post-meeting record** (AI transcript, editable action items, plus
genuinely private-per-user fields — a note and a 1–5 star rating+feedback, not visible to the
matched peer), and **session history**.

Flagging this as its own session rather than folding it into a generic roadmap entry because the
matching algorithm, video-call provider integration, and AI transcription pipeline are each
substantial scope on their own — comparable to how membership applications' payment integration and
articles' AI-summary generation were separately called out as deferred, except here the entire
feature is that scale, not one field of it. This has **zero real persistence in the prototype**
(unlike every other feature researched, including consultations) — a page reload resets everything,
so there's less to derive from the static build than usual; more of this will need to be designed
fresh rather than reverse-engineered.

## Events

**Source:** `events.html`, `admin-dashboard.html`'s events panels.

```
id, title, desc, org, start, end?, city, country,
format: 'In Person' | 'Hybrid' | 'Virtual',
category  -- own taxonomy (Tax/Legal/Audit/AI & Tech/Fintech/Law/Startup/General/
             International Law/Networking/M&A) — NOT the 12-item practice-area list
```

**Public suggestion flow**: anyone submits a suggested event → `pending` queue → admin
approve-and-publish (becomes a real event, same fields + a `website` link) or reject/delete. Admin
can also directly add-and-publish, bypassing the queue — same "seed + admin-added, one soft-hide
list" pattern as articles; don't reproduce the prototype's two-disconnected-pools version of this.

**"Register" is not built at all, not even client-side** — it's a UI stub. Flag as genuinely unbuilt
scope, not a shortcut to reverse-engineer, if/when RSVP becomes a real requirement.

**Sketch endpoints:** `GET /v1/events` 🌐 (published only) · `POST /v1/events/suggestions` 🔑 or 🌐
(tbd) · Admin: `GET`/`PATCH` suggestions (approve/reject), `POST /v1/events` (direct publish),
`DELETE /v1/events/:id`.

## Perks, Templates, Learnings

**Source:** `perks.html`, `templates.html`, `learnings.html`. All three are structurally identical —
simpler than everything else in this doc — and already use a real generic CRUD layer in the
prototype (`makeCrudLayer` in `admin-data.js`, genuine `id`-based add/update/remove, not an
array-index shortcut). No member-facing submission for any of the three; admin-only management,
member-only(?) read — none of the three pages have an actual in-page auth gate in the prototype
(same as articles' browse view), so whether these should be public or member-gated is a product
call, not something the design settles.

| | Fields | "Action" in the prototype |
|---|---|---|
| Perk | `category, name, discount (free text), desc, link` | external link-out only, no tracked redemption |
| Template | `category, title, desc, type (doc/xls/ppt), fileUrl` | plain download link, no download tracking |
| Learning | `category, title, desc, level, duration, lessons, link` | link-out only, no progress/completion tracking |

**Sketch endpoints (×3, same shape):** `GET /v1/{perks|templates|learnings}` · Admin:
`POST`/`PATCH`/`DELETE`. Worth requiring the link/file URL server-side rather than allowing empty —
the prototype's admin forms have no validation beyond "required" and empty links silently render as
dead buttons.

## Smaller/adjacent items

- **Newsletter subscriptions** — a plain email-capture form, unrelated to real accounts.
  `POST /v1/newsletter-subscriptions` 🌐, admin `GET` list.
- **Signup-source tracking** — the admin user-directory table has a `source` column (how someone
  found/joined Expertly) with no corresponding field on `profiles` today — likely just an additive
  column, not a new resource.
- **Global cross-entity search** (implied by `index.html`'s homepage search bar, spanning
  members/articles/events) — no new domain, just a possible future aggregate endpoint over
  already-planned resources. Low priority.
- `membership.html` — confirmed fully static marketing/pricing content, no dynamic data.

## Suggested build order (my judgment call, not a commitment)

1. **Member directory & profiles** — foundational; articles already resolves `authorName` against
   `profiles`, and consultations/dashboard/Peer Connect all reference member data. Resolve the
   renewal-lifecycle open question (above) as part of this session, since the admin view surfaces
   it right alongside profile data.
2. **Consultations** — simple CRUD, clear real-world value, no unresolved cross-cutting dependency
   once member profiles exist (need a valid `memberId` to request against).
3. **Perks / Templates / Learnings** — low complexity, same shape ×3, decide public-vs-member-gated
   once and apply it to all three.
4. **Events** — medium complexity (public suggestion queue + admin moderation, same pattern as
   articles' moderation-that-wasn't-built-this-time, so revisit whether events should get one).
5. **Peer Connect** — last, and treated as its own scoping session per above, not a quick add.

Resolve the "cross-cutting open decisions" section's admin-permissions question before #3 onward,
since every one of those sections has an admin-moderation surface that decision affects.
