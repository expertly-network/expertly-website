# Master TDD — Expertly Platform

This is the map of the project, not a duplicate of it. Every technical detail already has a home
(`docs/database-erd.md`, `docs/rest-api.md`, `docs/auth.md`, `docs/design-system.md`,
`docs/roadmap.md`, `packages/shared-types/`) — this document tells you which of those to open for
a given task, what's actually built versus planned versus merely sketched, and the order to build
in. When this document and one of the detail docs disagree, **the detail doc wins** — update this
file's summary, don't trust it over the source.

---

## Section 0 — How to use this document

### For developers
Read Section 1 once for orientation. After that, use the **routing table** (Section 9) to jump
straight to the doc(s) relevant to whatever you're building — you don't need to reread this file
end to end per session.

### For Claude Code sessions
Follow root `CLAUDE.md`'s session protocol. In short: identify the feature area, look it up in
Section 9's routing table, read only the docs it points to, confirm your plan before writing code,
and validate against `docs/user-stories.md`'s acceptance criteria before calling anything done.

### Document conventions
- ✅ **Built** — implemented and current in the linked doc.
- 🧱 **Schema only** — a Postgres table already exists (`supabase/migrations/`) but no backend
  module/REST endpoint reads or writes it yet.
- 📋 **Roadmap** — scoped in `docs/roadmap.md` from the design prototype, nothing built, no schema.
- 🔭 **Beyond-roadmap** — sketched in this document (Section 8) for future scoping; not in
  `docs/roadmap.md` yet, not committed to, needs its own design pass before it's real.

---

## Section 1 — Project overview

Expertly is a membership platform connecting clients with vetted expert members — consultations,
peer-to-peer connect, articles, events, perks/templates/learnings, and tiered membership & billing.
Full framing, brand personality, and design principles: `PRODUCT.md`.

**Three roles** (`profiles.role`): `client` (public signup, browses experts, books consultations),
`member` (vetted expert, application-gated, manages profile/content), `admin` (internal — see
Section 4's permission model, not a flat role in practice).

**Three surfaces:** the public/client-facing site, the member portal, and the admin/ops surface.
All three share one design system (`docs/design-system.md`) and one Next.js app — they're gated by
role via middleware, not separate frontends.

---

## Section 2 — Tech stack & architecture

Full non-negotiable rules and architecture decisions live in root `CLAUDE.md` — read that first,
every session. Summary: pnpm workspace + Turborepo monorepo, NestJS (Fastify adapter) backend as
the fixed REST contract in front of Postgres, Next.js App Router frontend calling that API +
`supabase-js` directly for auth only, Supabase Auth (hybrid) for identity. `packages/shared-types/`
is the compiler-enforced contract between the two.

---

## Section 3 — Database schema

Source of truth: `docs/database-erd.md`. Current schema: `supabase/migrations/0001_extensions.sql`
through `0004_tables.sql` — pre-production four-file convention, see
`supabase/migrations/README.md`.

| Table | Status | Backend module |
|---|---|---|
| `profiles` | ✅ Built | `auth/` |
| `categories`, `services` | ✅ Built | `practice-areas/` |
| `membership_applications` | ✅ Built | `applications/` |
| `articles` | ✅ Built | `articles/` |
| `member_profiles` + 7 child tables, `member_profile_edits`, `member_renewal_policy` | ✅ Built | `members/` |
| `events` | 🧱 Schema only | none — see Section 6 |
| `consultation_requests` | 🧱 Schema only | none — see Section 6 |
| `peer_connect_matches`, `peer_connect_member_preferences` | 🧱 Schema only | none — see Section 6 |
| Perks, templates, learnings | 📋 Roadmap — no schema yet | none |
| Newsletter subscriptions, signup-source tracking | 📋 Roadmap — no schema yet | none |
| Notifications (any kind) | 🔭 Beyond-roadmap — no schema | none |
| Vector embeddings / AI search | 🔭 Beyond-roadmap — no schema | none |

The `events`/`consultation_requests`/`peer_connect_*` tables were created in the initial schema
migration ahead of their API work — don't assume "table exists" means "feature is built." Verify
against `docs/rest-api.md` before relying on an endpoint existing.

---

## Section 4 — Auth & authorization

Source of truth: `docs/auth.md`. Summary: Supabase Auth owns identity; both frontend and backend
verify the JWT locally and read `app_role` off it for the common case, re-checking `profiles.role`
fresh from the DB only for admin routes. Admin is **not flat** in the API layer — see
`apps/backend/src/auth/constants/admin-permissions.ts`: three sub-tiers (`super_admin`,
`content_manager`, `reviewer`) each with a fixed permission set (`manageApplications`,
`manageArticles`, `manageMembers`, `manageEvents`, `manageConsultations`, `manageResources`,
`manageAdmins`, `deleteContent`, `writeArticles`, `viewDashboard`), enforced via
`@RequirePermission()` + `AdminPermissionGuard`. This was the design prototype's `admin-data.js`
model, made server-real during the Member Directory & Profiles session — `docs/roadmap.md`'s
"cross-cutting open decision #1" on this topic is resolved; that section of the roadmap doc is
stale.

Note: `manageEvents`, `manageConsultations`, and `manageResources` permissions already exist in
that constant even though events/consultations/perks-templates-learnings have no backend module
yet — the permission model was scoped ahead of the features it'll gate.

---

## Section 5 — API contract

Source of truth: `docs/rest-api.md` (built, fixed contract) and `docs/roadmap.md` (sketched,
**not** a contract — each section still needs its own backend session before it's real, per that
doc's own header). Access-level badges (🌐🔑🔒🛡️) are defined at the top of `docs/rest-api.md`.

---

## Section 6 — Feature areas: built, in-schema, and roadmap

One row per feature area. "Design source" is the `design/static_html/*.html` page(s) that are the
pixel/behavior reference per root `CLAUDE.md`'s methodology.

| Feature | Status | Design source | Notes |
|---|---|---|---|
| Auth (signup/login/OAuth) | ✅ Built | `login.html`, `admin-login.html` | No custom REST — `supabase-js` direct |
| Practice areas / taxonomy | ✅ Built | (embedded in several pages) | — |
| Membership applications | ✅ Built | `apply.html`, `onboarding_form.html`, `review.html` | Payment integration deferred — see `docs/rest-api.md`'s "not built yet" section |
| Articles | ✅ Built | `articles.html`, `article.html` | AI-summary generation deferred — see `docs/rest-api.md` |
| Member directory & profiles | ✅ Built | `members.html`, `member-profile.html`, `dashboard.html`/`dashboard-alt-3.html` | Per-section edit-approval workflow; `docs/roadmap.md`'s framing of this as unbuilt is stale |
| Consultations | 🧱 Schema only | `consultation-requests.html`, `my-consultations.html` | Sketch endpoints in `docs/roadmap.md` |
| Peer Connect | 🧱 Schema only | `peer-connect.html` | Monthly 1:1 matching program, not a directory — recommend its own scoping session per `docs/roadmap.md` |
| Events | 🧱 Schema only | `events.html` | Public suggestion queue + admin moderation pattern, same shape as articles |
| Perks / Templates / Learnings | 📋 Roadmap | `perks.html`, `templates.html`, `learnings.html` | Identical CRUD shape ×3; public-vs-member-gated is an open product call |
| Newsletter subscriptions | 📋 Roadmap | `index.html` (footer capture) | Plain email capture, unrelated to accounts |
| Global cross-entity search | 📋 Roadmap → 🔭 expanded below | `index.html` (homepage search bar) | Low priority per roadmap; see Section 8 for a fuller shape |
| `membership.html` | N/A | `membership.html` | Confirmed fully static marketing/pricing — no backend needed |

---

## Section 7 — Business rules already decided

These are rules already made real in code or in `docs/roadmap.md`'s research — restated here so a
session doesn't have to re-derive them:

- **Admin permissions** are sub-tiered (Section 4), not flat — every new admin-facing endpoint
  needs an explicit `@RequirePermission()`, not a bare `@Roles('admin')`.
- **Member profile edits are proposals, not direct writes.** Any change to a fact-asserting
  section (`engagements`, `testimonials`, `awards`) requires per-item proof and goes to `pending`
  until admin approval; plain-field sections (`headline_bio`, `contact`) don't need proof but still
  route through the same edit-request flow. See `docs/database-erd.md` / `docs/rest-api.md`.
- **No in-app messaging exists or is planned for consultations/Peer Connect** — both resolve to
  `mailto:`/`tel:` or a fixed meeting slot. Don't build chat.
- **Content moderation pattern**: articles, and (once built) events, both use a
  submit → `pending` → admin approve/reject queue, with admin also able to add-and-publish
  directly, on one soft-hide list — not the prototype's two-disconnected-pools shortcut.
- **Perks/Templates/Learnings have no submission, tracking, or completion state** in the design —
  link-out or download only. Don't invent redemption/progress tracking unless a future product
  decision adds it.

---

## Section 8 — Beyond-roadmap: future scoping (🔭 not committed)

`docs/roadmap.md` itself flags several needs it deliberately doesn't scope. These are sketched here
as a starting point for a future dedicated design session each — **none of this is authorized to
build from as-is**; each needs the same "read the design fresh, derive the real model" treatment
before it's real.

### 8.1 — Notifications
Every roadmap feature above has at least one "you'll be notified" trigger point with nothing behind
it yet: new consultation request, request completed/declined, Peer Connect match revealed,
reschedule proposed/accepted/declined, member profile-edit approved/rejected, application status
change, article/event moderation outcome. A real system needs at minimum: a `notifications` table
(recipient, type, payload, read state), a delivery decision (in-app feed vs. email vs. both — see
`member_renewal_policy`-style admin config as a precedent for making cadence configurable), and a
fan-out point in each triggering service. Recommend scoping as its own session once at least two of
the triggering features (e.g. consultations + member edits) are built, so the design isn't done in
a vacuum against zero real trigger points.

### 8.2 — Admin/ops overview dashboard
Today "admin" means a set of separate moderation surfaces (application review, member-edit review,
article review — plus events/consultations/resources once built) gated by individual permissions.
The design prototype's `admin-dashboard.html` implies a single landing surface with queue counts
per area, gated by `viewDashboard` (already a permission in `admin-permissions.ts`). Worth a
dedicated small session once events/consultations exist, so the dashboard has more than two real
queues to summarize.

### 8.3 — Search & discovery
`docs/roadmap.md` flags a homepage global search bar spanning members/articles/events as "low
priority, no new domain." Beyond that literal read, worth eventually considering: faceted filtering
already exists per-resource (`GET /v1/members` has search/filter/sort per `docs/rest-api.md`) —
a real cross-entity search is an aggregation layer over those, not a new data model. Full-text
(Postgres `tsvector`) is sufficient for the current data volume; vector/embedding-based semantic
search is explicitly **not** scoped — there is no embedding column in any current migration, and
adding one is a separate, later decision, not a default. Don't add `vector(...)` columns or call
an embedding API speculatively.

### 8.4 — Billing & renewal payments
`member_renewal_policy` (global config: validity period, due-soon threshold) already exists
(migration `0002`) and tracks *when* a member is due, but there is no payment-collection flow for
renewal — same gap `docs/rest-api.md` already flags for the initial application fee. Both are the
same underlying problem (real payment provider integration) and should likely be solved together
in one session rather than twice.

---

## Section 9 — Routing table

What to read for a given task. "Docs" lists what to open; "User stories" points into
`docs/user-stories.md`.

| Task | Docs | User stories |
|---|---|---|
| Monorepo / tooling changes | root `CLAUDE.md` | — |
| Auth flow (login/signup/OAuth/session) | `docs/auth.md` | US-02 |
| Practice areas / taxonomy | `docs/rest-api.md` | US-01 |
| Membership applications | `docs/database-erd.md`, `docs/rest-api.md` | US-03, US-04 |
| Member dashboard | `docs/rest-api.md` | US-05 |
| Articles | `docs/database-erd.md`, `docs/rest-api.md` | US-07 |
| Member directory & profiles (read) | `docs/database-erd.md`, `docs/rest-api.md` | US-01, US-06 |
| Member profile self-edit workflow | `docs/database-erd.md`, `docs/rest-api.md`, Section 7 | US-06 |
| Admin: applications | `docs/rest-api.md`, Section 4 | US-08 |
| Admin: members / edit review / renewal policy | `docs/rest-api.md`, Section 4 | US-09 |
| Admin: articles / admin permission management | `docs/rest-api.md`, Section 4 | US-10 |
| Consultations (new session) | `docs/roadmap.md` §Consultations, Section 6 | US-11 |
| Peer Connect (new session) | `docs/roadmap.md` §Peer Connect, Section 6 | US-12 |
| Events (new session) | `docs/roadmap.md` §Events, Section 6 | US-13 |
| Perks / Templates / Learnings (new session) | `docs/roadmap.md` §Perks..., Section 6 | US-14 |
| Newsletter / signup-source | `docs/roadmap.md` §Smaller/adjacent | US-15 |
| Design tokens / components | `docs/design-system.md` | — |
| Deployment / CI | `docs/deployment.md` | — |
| Anything not yet scoped | Section 8, then `docs/roadmap.md`'s methodology | US-16, US-17, US-18 |

---

## Section 10 — Build order

Reflects what's actually built plus `docs/roadmap.md`'s suggested order for what isn't, adjusted
for what turned out to already have schema:

1. ✅ Monorepo, auth, practice areas, membership applications, articles, member directory & profiles
2. **Consultations** — schema exists, simple CRUD, no unresolved dependency once member profiles
   exist (needs a valid `memberId`).
3. **Perks / Templates / Learnings** — no schema yet, low complexity, same shape ×3; resolve
   public-vs-member-gated once, apply to all three.
4. **Events** — schema exists; medium complexity (suggestion queue + admin moderation).
5. **Peer Connect** — schema exists but is the largest remaining feature (matching algorithm,
   video-call integration, AI transcription); its own dedicated scoping session, build last.
6. **Beyond-roadmap** (Section 8), only once at least two of the above are live: notifications,
   admin/ops overview dashboard, search, renewal billing.

---

## Section 11 — Session closing checklist

At the end of any session touching backend or frontend:
- [ ] List every file created or modified
- [ ] State whether the relevant `docs/user-stories.md` acceptance criteria are met
- [ ] Note any TODOs or explicitly deferred scope (name it, don't leave it silent)
- [ ] Confirm `docs/rest-api.md` / `docs/database-erd.md` / `packages/shared-types/` were updated
      if the contract changed
- [ ] Confirm no hardcoded credentials or keys
- [ ] Confirm typecheck passes (`pnpm typecheck`)
