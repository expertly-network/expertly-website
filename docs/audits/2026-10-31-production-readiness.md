# Security, quality, and production-readiness audit

Date: 31 October 2026 (Asia/Kolkata). Base commit: `3638ff4a432e4826c7e23264aade6f234b18365f`, plus the existing working tree.

**Release assessment: not ready for production sign-off.** The code has useful security controls and passes its existing unit tests, but concrete security, concurrency, and deployment defects remain. Passing these checks cannot establish a 100% security or performance guarantee.

This was an audit, with independent backend, frontend, and database/operations reviewers. Application code, dependencies, deployment settings, and database contents were not modified. This report is the only repository artifact added by this audit. Existing uncommitted application work was preserved. The working tree changed during the review, so results apply to the inspected/build-tested snapshot rather than every subsequent edit.

## Executed validation

| Check | Result | Meaning / limit |
| --- | --- | --- |
| `pnpm typecheck` | Pass | Backend, frontend, shared types; shared-types result reused Turbo cache |
| `pnpm lint` | Pass | No lint errors; frontend `next lint` emits a deprecation notice |
| `pnpm test` | Pass | Backend: 437 tests / 16 files; frontend: 129 tests / 10 files |
| `pnpm build` | Pass | Backend and optimized Next.js production builds completed |
| `pnpm format:check` | Fail | 19 pre-existing modified frontend files need formatting |
| `git diff --check` | Pass at execution | No whitespace errors in tracked diff at that point |
| `pnpm audit --prod --audit-level=low` | Pass | No known production dependency advisories returned |
| `pnpm audit --json` | One low advisory | `deepmerge@4.3.1`, via Nest CLI build tooling; no high/critical findings |
| Isolated backend HTTP smoke | Pass | Liveness 200; unauthenticated admin/search 401; production Swagger 404; disallowed origin gets no CORS allow header; request IDs/security headers present |
| Built frontend HTTP smoke | Finding reproduced | `/login` has CSP; `/members/example.png` and `/articles/example.png` return 200 HTML without CSP |
| Offline concurrency harness | Finding reproduced | Ten simultaneous consultation creates all accepted despite daily maximum three |
| Offline search hydration harness | Finding reproduced | Hidden-account member/article fixtures returned; no account-status lookup performed |

Local validation used Node `v24.14.0`, pnpm `9.15.0`; CI/runtime target Node 22. Docker CLI/daemon were available, but no database/container images were installed. Docker images were not built locally. No live production mutation, load test, database migration, or external AI call was performed. HTTP smoke used a separate local API with placeholder Supabase configuration.

The dependency advisory is [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), concerning returned-object prototype poisoning in deepmerge. The advisory currently lists no patched version. Its observed path is `@nestjs/cli > fork-ts-checker-webpack-plugin > deepmerge`; this is a build-tool exposure, not a demonstrated public application exploit.

## Findings and required remediation

### S1 — Medium: search ignores current account / author visibility

Evidence: `apps/backend/src/search/search.repository.ts:313` (hydration), especially checks at approximately 340 and 360; `search.repository.ts:202` (author names only); `apps/backend/src/search/card-builder.service.ts:86`; `supabase/migrations/0003_functions.sql:324`.

Hydration checks member listing status and article publication status, but does not check `profiles.status`, `deleted_at`, or article-author visibility. Direct member/article endpoints enforce stricter visibility. A suspended account can remain discoverable through search. Member cards depend on worker catch-up. Article exposure can persist: profile/member-profile changes queue only member cards, and rebuilding an article still checks publication status without author eligibility.

The offline harness returned both hidden fixtures and showed reads only from `member_profiles`, `member_services`, and `articles`. It demonstrates missing checks, not a real production data disclosure.

Fix: enforce the same current visibility predicate across directory, detail, search hydration, and card generation. Queue affected articles when author visibility changes. Filter before sending candidate card text to the AI judge. Add tests for suspension, soft deletion, member deactivation, stale cards, and worker outage.

### S2 — Medium: concurrent consultation requests bypass quotas / cooldown

Evidence: `apps/backend/src/consultations/consultations.service.ts:85`, `:117`, `:157`; consultation schema in `supabase/migrations/0004_tables.sql:608`.

Eligibility reads and insertion are separate operations. Concurrent requests can all read an eligible state before any insert becomes visible. The offline harness accepted 10 of 10 creates where the default daily limit is three. HTTP rate limiting does not enforce this lower business quota atomically.

Fix: a database transaction/RPC serializing creation per requester, rechecking quota and pending cooldown within that transaction, then inserting. Test simultaneous requests to the same and different members, reset boundaries, and multiple API replicas against real Postgres.

### S3 — Medium: concurrent application uploads overwrite document references

Evidence: `apps/backend/src/applications/applications.service.ts:336` through `:376`; `apps/backend/src/applications/applications.repository.ts:223` and `:417`.

Upload reads the current documents array, stores a new object, and writes a replacement array. Two concurrent uploads can each start with the same array; the last write removes the other's reference while both objects remain stored. Draft checks do not prevent lost updates. This is source-confirmed; a separate storage race reproduction was not executed.

Fix: atomic append with document-count and draft-state checks, using a normalized document table or transactional RPC/version comparison. Clean up newly uploaded objects when persistence fails. Test concurrent upload/upload and upload/submit operations.

### S4 — Medium: file-extension matcher disables CSP on HTML routes

Evidence: `apps/frontend/middleware.ts:98`.

The middleware excludes all paths ending in several static-file extensions, including dynamic member/article paths. Actual local production responses for `/members/example.png` and `/articles/example.png` were HTTP 200 with `text/html` and no Content-Security-Policy. The normal login page had CSP. Session refresh is also skipped. This is a defense-in-depth gap, not a demonstrated backend authentication bypass or XSS execution.

Fix: limit exclusions to actual asset paths and known static files; apply CSP/session handling to dynamic HTML regardless of suffix. Add HTTP-level regressions for member/article/admin paths and browser tests confirming nonces and script execution.

### S5 — Medium: Docker build context permits standard environment files

Evidence: `.dockerignore:7`; both Dockerfiles' `COPY . .` at line 20.

`.env` and local variants are excluded, but `.env.production`, `.env.development`, and `.env.test` are not. Local builds can send these files into builder stages and caches; Next can also load production env files. No runtime-image secret disclosure was demonstrated.

Fix: exclude `**/.env*` and allow template files explicitly. Verify build context and final image layers with harmless sentinel fixtures. Keep production credentials in runtime secret configuration.

### S6 — Medium: deployment races can mix service revisions

Evidence: `.github/workflows/ci.yml:95`, `:108`, `:140`.

Backend and frontend mutable `latest` tags publish separately; no workflow/deployment serialization exists. Two pushes can interleave image publication and triggers, deploy different revisions together, or let an older build overwrite a newer tag. A frontend build failure after backend publication also leaves a partially updated tag set.

Fix: deploy a coordinated release using immutable commit tags/digests only after all images pass; serialize release promotion and prevent stale runs from promoting. Test rollback and rapid consecutive releases.

### S7 — Medium: CI success does not establish successful deployment

Evidence: `.github/workflows/ci.yml:140`; `docs/deployment.md:30`.

CI ends after the asynchronous Coolify deployment trigger returns. It does not check completed rollout, running commit identities, or worker progress. The docs describe a previous successful trigger with stale containers.

Fix: bounded rollout polling, frontend/API readiness and smoke tests, a deployed-version identifier, and worker heartbeat/outbox-lag monitoring. Fail deployment status when the rollout or smoke tests fail.

### Q1 — Medium reliability: frontend API calls lack explicit deadlines

Evidence: `apps/frontend/lib/api/client.ts:19`; `apps/frontend/lib/api/server.ts:59`, `:71`.

An upstream stall can hold SSR sections and UI mutation states until an external network/proxy deadline. Backend database and AI requests already have deadlines.

Fix: bounded operation-specific deadlines, composed with caller cancellation, and actionable timeout errors. Avoid automatic mutation retries without idempotency. Test stalled fetches, cancellation, and recovery.

### Q2 — Medium accessibility: modal keyboard handling incomplete

Evidence: `apps/frontend/components/ui/Modal.tsx:25`; `apps/frontend/components/home/SearchModal.tsx:145`.

Dialogs do not consistently trap focus, restore it to the triggering control, or make background content inert. Search moves initial focus but still lets keyboard navigation leave the modal.

Fix: a shared accessible dialog implementation and browser keyboard tests for initial focus, Tab/Shift+Tab, Escape, nested dialogs, and focus restoration.

### Q3 — Production-content blocker: placeholders render as real endorsements

Evidence: `apps/frontend/components/home/Testimonials.tsx:9`, `:80`; `apps/frontend/components/home/Newsletter.tsx:9`, `:80`.

Testimonials are labeled placeholders only in source, while the page renders invented names, quotes, portraits, and outcome claims as endorsements. Newsletter advertises 4,200+ readers despite having no subscription backend.

Fix: remove unsupported claims or visibly label illustrative content; show the newsletter's availability before submission. Obtain approved, attributable testimonials before publishing them as real.

### Q4 — Low: unreleased preview object URLs

Evidence: `apps/frontend/components/members/edit/SectionEditModal.tsx:299`.

Logo previews create object URLs without revocation on replacement, removal, or unmount. Repeated editing retains browser memory. Revoke URLs at those lifecycle points and exercise repeated uploads.

### Q5 — Low standards / enforcement gaps

- `packages/shared-types/README.md:11` says all DTOs are Swagger classes and forbids runtime constants at line 23; `resource.ts` uses interfaces/constants. Align the documented architecture with actual safe usage.
- Backend validation DTOs and shared request types remain manually synchronized. Type assertions on fetched JSON do not validate response bodies. Add focused contract tests/schema generation for validation rules, enums, optionality, and response shapes; compile success alone cannot detect every drift.
- Frontend lint uses deprecated `next lint`. Migrate to the ESLint CLI before a framework upgrade.
- Formatting fails in 19 files in the pre-existing dirty work. Run targeted formatting after the current parallel work settles, then rerun the gate.
- Runtime/toolchain consistency: repeat final gates on the supported Node 22 image; this audit ran Node 24 locally.

## Performance assessment

The build reports approximately 103 kB shared first-load JS; homepage 207 kB, directory 202 kB, member profile 218 kB, and article editor 329 kB. These are build outputs, not measured Core Web Vitals or proof of a performance defect.

Per-request CSP nonces intentionally cause dynamic HTML rendering (`app/layout.tsx:31`); public API lists have a 60-second data cache, while authenticated data uses `no-store`. This protects viewer-specific responses but makes SSR capacity and upstream latency important. Public list caches can also retain removed content for up to their TTL. Decide whether that delay is acceptable for suspension/removal.

Location data and PDF work already use dynamic imports. Review rich editor loading and large route bundles using a bundle analyzer if browser measurements show a problem.

Before performance sign-off, run repeatable mobile/desktop browser measurements for home, directory, profile, article, login, dashboard, and admin; capture LCP/INP/CLS, TTFB, long tasks, transferred bytes, and cache behavior. Load-test read traffic, authenticated writes, search, and uploads on an isolated staging environment with representative data. Record p50/p95/p99 latency, throughput, errors, CPU/RSS, database query plans, and AI spend under concurrency. Define acceptance budgets first; do not infer capacity from localhost response times.

## Infrastructure and test gates still outstanding

1. Verify current infrastructure rather than assuming repository docs are current. `docs/deployment.md:3` and `:48` explicitly describe a dev-only environment answering production domains. Establish isolated production configuration, controlled promotions, and rollback evidence.
2. Freeze a reviewed schema baseline and adopt additive versioned migrations. `supabase/migrations/README.md:20` currently edits old migrations and relies on untracked catch-up SQL. Capture actual schema drift before upgrading an existing database; never rebuild user data to resolve drift.
3. Add disposable Supabase/Postgres migration execution to CI. Test actual anonymous/authenticated/service-role privileges, own-profile reads, auth-hook execution, private Storage access, browser write rejection, and destructive actions. Existing route-access tests inspect metadata; they do not replace HTTP/database tests.
4. Add authenticated end-to-end journeys: signup/confirmation, OAuth linking, refresh/logout, password recovery, role/status changes, ownership/IDOR negatives, application/private uploads, review, articles, consultations, and resource entitlements. Existing suites are offline unit/mocked tests, with no browser journey suite found.
5. Verify Supabase email confirmation and secure password change; token hook registration/grants; private document migration; absence of unexpected Storage policies; and edge limits on both frontend and directly reachable public API. The global backend rate limiter deliberately skips anonymous users and uses in-memory per-instance counters for authenticated users. CORS is not protection against non-browser traffic. If API is public, frontend-only limiting leaves an anonymous API path unprotected.
6. Define account-revocation guarantees: ordinary routes use JWT status claims until refresh/expiry; admin routes check fresh state. Verify configured JWT lifetime and decide whether sensitive ordinary actions need immediate status rechecks. Test with an already-issued token after suspension.
7. Verify TLS/firewall settings, including the deployment doc's unresolved plain-HTTP Coolify port 8000 note. This was not live-tested.
8. Perform a restore drill for database, Auth configuration, and binary Storage objects. Seeds retain paths but do not contain the resource/template binaries. Demonstrate RPO/RTO and correct private/public access after restore.
9. Add alerting for auth-hook failures, HTTP error/latency rates, worker heartbeat, outbox lag, stuck embeddings, database availability, and AI cost. Search worker HTTP health is intentionally disabled; it needs a separate progress signal.
10. Run image/container scanning, actual production-image smoke tests, and a secret scanner over tracked files/history and build artifacts. This audit checked tracked env/key filenames and relevant code; it was not a full history secret scan.

## Existing controls observed

JWT algorithms/issuer/audience are pinned; privileged routes recheck current database state and permissions. Global validation rejects unknown DTO fields. Ownership checks exist across the reviewed mutation paths. Uploads have byte/MIME/size limits, private proof/document buckets, and signed access. HTML sanitization is covered by tests. LinkedIn image fetching restricts source hosts. Backend database and AI calls have deadlines. Browser database/function privileges are tightly revoked in fresh-schema SQL. Runtime Docker users are non-root; CI actions are SHA-pinned with restricted permissions. Authenticated fetches avoid shared caching.

No confirmed critical/high exploit was identified in the reviewed code. This is not evidence that none exists. Findings above should be fixed and covered by targeted regression tests, followed by the live infrastructure, restore, end-to-end, and load gates before release approval.
