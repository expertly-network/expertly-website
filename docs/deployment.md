# GrowXQ (formerly Expertly) — Deployment Reference (Coolify, dev environment)

**Scope: this document covers the `dev` Coolify environment only — it is not a production
deployment guide.** Production deployment is a separate, deliberately-not-yet-done effort that
will get its own documentation when it happens; don't treat anything below as "production is set
up." The one wrinkle: the `dev` environment's containers currently also answer on the production
domain names (`expertly.network`, `www.expertly.network`) via the domain/Traefik config described
below — that's an interim routing arrangement made while building this pipeline, not a statement
that production is live or properly deployed. Revisit that domain routing when production
deployment is actually designed.

Full reference for how the dev environment's deployment actually works, kept separate from
`CLAUDE.md`/`README.md` so those stay scannable. Read this before touching CI/CD, Coolify config,
or anything DNS/proxy related. `README.md`'s "Deploying" section is the quick-start; this file is
the detail and the "why" behind each non-obvious piece.

## Platform

The app runs on a Hostinger VPS (`91.108.104.17`, DNS name `shreyansmaloo.site`) via
**[Coolify](https://coolify.io)**, a self-hosted PaaS. Coolify dashboard:
`https://coolify.shreyansmaloo.site` (the old `http://shreyansmaloo.site:8000` /
`http://91.108.104.17:8000` still answer, but are plain HTTP — don't send tokens there). Traefik is Coolify's built-in reverse proxy/TLS terminator
(`coolify-proxy` container) — it is not configured by hand.

Both apps are **Docker Image**-type Coolify resources (Coolify pulls a prebuilt tag, it does not
build from source) — this matters for the auto-deploy design below.

## Healthcheck paths (manual Coolify dashboard step)

Each app's **Healthcheck** settings (left sidebar of its Coolify page) must point at a route that
returns 200 independent of whatever page content happens to exist at a given commit — not `/`.
`/` broke this exact assumption once already: mid-way through a history rewrite, a commit had no
homepage route yet, `/` correctly 404'd, Coolify's healthcheck treated the new container as
unhealthy, and it auto-rolled-back to the old container on every deploy — CI reported the deploy
trigger as successful the whole time, masking the real problem.

| App | Healthcheck path | Notes |
|---|---|---|
| `expertly-backend` | `/v1/health/ready` | `AppController.getReadiness()` — **readiness**: 200 only when the database answers, `503 DATABASE_UNAVAILABLE` otherwise, so a container that booted but can't reach Supabase never takes traffic. `/v1/health` is the plain **liveness** check (200 whenever the process is up, no DB call) — use it for manual "is it running" curls. Note the `/v1` global prefix; `/health` alone 404s |
| `expertly-frontend` | `/api/health` | `app/api/health/route.ts` — deliberately independent of `app/page.tsx` and every other route |

This is a one-time setting in each app's Coolify **Healthcheck** page — not something CI or this
repo's code can set. Verify it's configured this way (not `/`) whenever debugging a "deploy
succeeded but the site looks stale" symptom.

## One environment, two domain sets (for now), one image each

There is a single Coolify environment, named **`dev`**, inside the `Expertly` project. There is no
separate production environment yet — production deployment hasn't been designed/built. As an
interim arrangement, this `dev` environment's two containers (one `expertly-backend`, one
`expertly-frontend`) are currently also routed-to from the production domain names, purely so those
domains show *something* rather than pointing at nothing. That routing is not "production
deployed" — see the scope note at the top of this file.

| App | Image | Domains currently routed to it |
|---|---|---|
| `expertly-backend` | `ghcr.io/expertly-network/growxq-backend:latest` (was `expertly-backend` before the Oct 2026 rename) | `api.expertly.network`, `dev-api.expertly.network` |
| `expertly-frontend` | `ghcr.io/expertly-network/growxq-frontend:latest` (was `expertly-frontend`) | `expertly.network`, `www.expertly.network`, `dev.expertly.network`, `www.dev.expertly.network` |

The frontend is **one image** for every environment, and the image carries **no deployment config**.
`NEXT_PUBLIC_*` env vars are inlined into the client bundle at `next build` time, so anything
deployment-specific must not be one: a single CI build would hard-wire one environment's backend and
Supabase project into every deployment (this is exactly how growxq.com once silently served the dev
API and dev database). So `API_URL`, `SUPABASE_URL` and `SUPABASE_ANON_KEY` are **runtime-only**
Coolify env vars on each frontend app (no rebuild needed to change them), and CI has no secrets or
build args for them:

- `apps/frontend/lib/env.ts` — `getApiUrl()`, `getSupabaseUrl()`, `getSupabaseAnonKey()`. On the
  server/middleware they read `process.env` per process; in the browser they read
  `window.__GROWXQ_CONFIG__`.
- `apps/frontend/app/layout.tsx` — injects `{ apiUrl, supabaseUrl, supabaseAnonKey }` into every
  page as `window.__GROWXQ_CONFIG__` (one nonce'd inline script, `publicConfigScript()`). None of
  these is secret (the anon key is public by design).
- `apps/frontend/lib/api/base-url.server.ts` also calls `headers()`, which keeps API-calling pages
  rendered at request time rather than prerendered during `next build`. Kept in a **separate file**
  from `base-url.client.ts` — importing `next/headers` anywhere reachable from a Client Component
  bundle breaks the build.
- No fallbacks in production: a missing `SUPABASE_URL` / `SUPABASE_ANON_KEY` (always) or `API_URL`
  (production) throws with the variable's name. Outside production `API_URL` defaults to
  `http://localhost:4000`.
- `next/image` can't know the Supabase host at build time, so `next.config.js` allows any
  `*.supabase.co` project's public-storage path; `lib/images.ts` only sends this deployment's own
  project through the optimizer. (A Supabase custom domain would need adding there.)

Until Oct 2026 this was a hard-coded hostname → API map (`API_HOSTS`) in `base-url.shared.ts`;
it was replaced so no domain lives in code (the GrowXQ rebrand changes every domain).

## Search worker (second app, same image)

AI search needs a background process besides the API: it rebuilds search cards from the outbox,
embeds new/changed cards, and runs daily cleanup. It is **the same image** as `expertly-backend`
started with a different command — a second Coolify resource, not a second repo or image
(`apps/backend/src/worker.ts`; verified: the production image contains
`dist/apps/backend/src/worker.js` and runs it with the command below).

| Setting | Value |
|---|---|
| Resource type | Docker Image |
| Image | `ghcr.io/expertly-network/growxq-backend:latest` (same tag as the API) |
| Entry point | env var `APP_ENTRY=worker`. Coolify's Docker Image apps have no start-command override, so the image's `CMD` (`apps/backend/Dockerfile`) runs `dist/apps/backend/src/${APP_ENTRY:-main}.js` — unset on the API app (runs `main.js`), `worker` here (runs `worker.js`, same as `pnpm start:worker`). Any other value exits with an error |
| Domains / exposed port | **none** — it listens on no port |
| Healthcheck | **disabled** — `/v1/health` belongs to the API only; the worker has no HTTP server, so a path healthcheck would mark it permanently unhealthy and trigger rollbacks |
| Replicas | **1** (the outbox claim is multi-worker safe, but two embedders just double-spend OpenAI calls) |
| Stop grace period | **60 s** (Advanced → Operations): on SIGTERM the worker finishes the batch in flight, which can take up to ~30 s (OpenAI timeout) |

Environment variables for the worker app:

| Variable | Notes |
|---|---|
| `APP_ENTRY` | `worker` (see "Entry point" above) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | same values as the API; service-role key only ever on the backend |
| `OPENAI_API_KEY` | **required** — the worker refuses to boot without it (embeddings run on every tick) |
| `OPENAI_EMBED_MODEL` | `text-embedding-3-small` (must stay 768-dimensional; the model is part of `embedding_model` on every card) |
| `OPENAI_CHAT_MODEL` | `gpt-4.1-mini`. The worker does not call chat models; set it anyway so both apps share one env list (the **API** needs it) |

The API app additionally needs `OPENAI_API_KEY` for `POST /v1/search` (`OPENAI_CHAT_MODEL` /
`OPENAI_EMBED_MODEL` default to the values above when unset). It must **not** set `APP_ENTRY` (the
API process runs no loops). Both entry points validate their environment at boot
(`apps/backend/src/config/env.ts`) and exit with the list of offending variable **names** (never
values) — see "Backend environment" below.

Redeploys: the worker app carries the Coolify tag `autodeploy`, so the CI "Trigger Coolify
redeploy" step (which deploys by tag — see below) redeploys it with the API on every push to
`main`. The Coolify app is `expertly-search-worker` (`urxutbn4gxgcucqjkyj16k8g`) in the `dev`
environment. The worker logs to stdout; look for `Search worker running.` and the
`Embedder loop started` / `Outbox loop` lines in Coolify's log view.

## CI/CD pipeline

`.github/workflows/ci.yml`, on every pull request to `main` and every push to `main`:

1. **Lint, Typecheck & Build** — `pnpm install --frozen-lockfile` → `pnpm audit --prod
   --audit-level=high` (fails on a known high/critical advisory in a shipped dependency) →
   `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test` (Turbo runs `test` in every
   package that defines a `test` script; a package without one is skipped) → `pnpm build`. The
   merge gate.
2. **Build (& Push on main) Docker Images** (only if step 1 passes) — builds both Dockerfiles for
   `linux/amd64` on **every PR too**, so a broken Dockerfile fails review rather than the deploy;
   only a push to `main` logs in and pushes, as both
   `ghcr.io/expertly-network/growxq-{backend,frontend}:latest` and `:<commit sha>` (the sha tag is
   the exact build to roll back to — point the Coolify app at it). Authenticated with the
   workflow's own `GITHUB_TOKEN` (no PAT needed — GHCR under the repo's own org needs nothing
   extra). The images take no build args — all deployment config is runtime (see "One environment"
   above).
3. **Trigger Coolify redeploy** — the last step of the same job, `main` pushes only. The token is
   passed to the shell as the `COOLIFY_API_TOKEN` env var (`-H "Authorization: Bearer
   $COOLIFY_API_TOKEN"`), never interpolated into the script text. Since Coolify's apps here are
   prebuilt-image resources rather than git-triggered builds, Coolify's own git-source webhooks
   (GitHub/GitLab/etc., visible under each app's *Webhooks* settings page) don't apply — those
   exist for apps Coolify builds from a repo checkout. Instead this step `curl`s Coolify's generic
   API deploy endpoint directly, **by tag**:
   ```bash
   curl -X POST "https://coolify.shreyansmaloo.site/api/v1/deploy?tag=autodeploy&force=true" \
     -H "Authorization: Bearer <token>"
   ```
   Every Coolify app tagged **`autodeploy`** is redeployed — today `expertly-backend`,
   `expertly-frontend` and `expertly-search-worker` (the `Outline Docs` service is deliberately
   untagged). To put a new app on auto-deploy, add the tag on its **Tags** page in Coolify; no CI
   or GitHub-secret change is needed. (This replaced an earlier `?uuid=<id>,<id>` call that needed
   one GitHub secret per app id.) Note it's `POST`, not
   `GET` (the API used to be `GET`; Coolify returns a `405` with a "this endpoint has changed to a
   POST request" body if you use the old verb — easy to hit if copying older Coolify docs/examples).

   **Use `force=true`, not `force=false`.** Both images are pushed to the same `:latest` tag, and
   `force=false` was observed to let this step return success while Coolify silently skipped the
   actual re-pull/restart — the CI step showed green but the running container kept serving a
   build from well before that push. `force=true` always re-pulls and restarts.

So: push to `main` → audit/lint/typecheck/test/build gate → both images rebuilt and pushed → Coolify
redeploys every `autodeploy`-tagged app with the new images. Fully automatic, no manual "Redeploy" click needed.

Every third-party action is pinned to a full commit SHA with its version in a trailing comment
(`uses: actions/checkout@<sha> # v4.4.0`) — a moved or compromised tag can't change what runs. To
upgrade one, resolve the new tag to its commit (`git ls-remote https://github.com/<owner>/<repo>
'refs/tags/<tag>*'` — for an annotated tag use the `^{}` line) and update both the SHA and the
comment.

### Required GitHub Actions secrets (repo `expertly-network/expertly-website`)

| Secret | Purpose |
|---|---|
| `COOLIFY_API_TOKEN` | Bearer token for the deploy-trigger step. Created under Coolify → **Keys & Tokens → API Tokens**, scoped to the `Deploy` permission only (least privilege — it can't read/write anything else). **Expires 2027-08-18** — needs manual rotation before then, since an expired token fails the deploy step silently-ish (the `curl` will just 401). |

That is the only secret. There are deliberately **no** `NEXT_PUBLIC_API_URL` /
`NEXT_PUBLIC_SUPABASE_*` secrets — the frontend's API and Supabase settings are runtime Coolify env
vars per deployment (see "One environment" above), never part of the build.

## Requirements

The full required configuration, by area. This is the source of truth to check/restore against —
not a log of past issues.

### Node version

**22**, set consistently in all of:
- `apps/backend/Dockerfile` (`base` and `runtime` stages)
- `apps/frontend/Dockerfile` (`base` and `runtime` stages)
- `.nvmrc`
- root `package.json` → `engines.node`
- `.github/workflows/ci.yml` → `node-version`

### Coolify healthcheck

| Setting | Frontend | Backend |
|---|---|---|
| Host | `127.0.0.1` | `127.0.0.1` |
| Port | `3000` | `4000` |
| Path | `/api/health` | `/v1/health/ready` |
| Method | `GET` | `GET` |
| Scheme | `HTTP` | `HTTP` |
| Expected code | `200` | `200` |
| Interval | `5s` | `5s` |
| Timeout | `10s` | `10s` |
| Retries | `10` | `10` |
| Start period | `20s` | `20s` |

### Backend environment

Validated at boot by `apps/backend/src/config/env.ts` — a missing or malformed variable stops the
process with the variable's name in the log (an empty `KEY=` counts as unset). Mirror of that file:

| Variable | API | Worker | Notes |
|---|---|---|---|
| `SUPABASE_URL` | required | required | http(s) URL |
| `SUPABASE_SERVICE_ROLE_KEY` | required | required | backend only, never on the frontend |
| `NODE_ENV` | optional | optional | `development` (default) / `production` / `test` |
| `CORS_ORIGINS` | **required when `NODE_ENV=production`** | — | comma-separated http(s) origins, e.g. `https://expertly.network,https://www.expertly.network,https://dev.expertly.network`. There is no "any origin" fallback: production without it doesn't boot |
| `PORT` | optional (`4000`) | — | 1–65535 |
| `OPENAI_API_KEY` | optional at boot; needed for `POST /v1/search` and for AI drafting with `AI_PROVIDER=openai` | **required** | |
| `OPENAI_EMBED_MODEL`, `OPENAI_CHAT_MODEL` | optional | optional | defaults in `search.config.ts` |
| `AI_PROVIDER`, `AI_MODEL` | optional | optional | `openai` / `anthropic` / `google`; unset disables AI drafting (its endpoints 503) |
| `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | optional | optional | for the matching `AI_PROVIDER` |
| `SWAGGER_ENABLED` | optional | — | `true` / `false`; docs at `/api` are off by default in production |
| `ARTICLES_REVIEW_MODE` | optional (`instant`) | — | `instant` / `editorial` |
| `SITE_LAUNCHED` | optional (launched) | — | `false` during the founding-cohort pre-launch: the application doesn't require peer references. **Set it together with the frontend's `SITE_LAUNCHED`** — a frontend at `false` with a backend left unset hides the references section but the backend still demands them at submit (`400 APPLICATION_INCOMPLETE`) |
| `UNSPLASH_ACCESS_KEY` | optional | — | |
| `LINKEDIN_IMPORT_WEBHOOK_URL` | optional | — | http(s) URL |
| `CONSULTATION_REQUEST_LIMIT`, `CONSULTATION_REQUEST_WINDOW_DAYS`, `CONSULTATION_PENDING_COOLDOWN_DAYS` | optional | — | positive integers; an invalid value fails boot rather than silently using the default |

Every API response carries an `X-Request-Id` header (a caller-supplied one is kept if it looks like
an id, otherwise one is generated); the same id is on that request's log lines — ask for it in a
bug report and grep the Coolify logs for it.

### Frontend environment

| Variable | When | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | **runtime, required** (Coolify env) | this deployment's Supabase project; every request fails with the variable's name if missing |
| `API_URL` | **runtime, required in production** (Coolify env) | the backend's public base URL — see "One environment" above |
| `NEXT_PUBLIC_SITE_URL` | **runtime, required in production** | the frontend's public origin(s), comma-separated, canonical first — every domain routed to the container, e.g. `https://expertly.network,https://www.expertly.network,https://dev.expertly.network,https://www.dev.expertly.network`. Read at runtime (`apps/frontend/lib/env.ts`), so it does not need to be a build arg |

**Server-side origin resolution.** Any server-side code that needs "our own public URL" (the OAuth
callback's redirect, absolute links) uses `getSiteUrl()` (canonical origin) or `resolveSiteUrl(host)` — never `request.url` (the
container's bind address behind Traefik) and never a raw `Host` / `X-Forwarded-Host` header, which a
client can set to bounce a freshly signed-in user to a host it controls (open redirect).
`resolveSiteUrl` only uses the header to *choose among* the configured origins, so a user who signs
in on `dev.expertly.network` comes back to that host (where their session cookies were set). Reference:
`apps/frontend/app/auth/callback/route.ts`. A missing `NEXT_PUBLIC_SITE_URL` in production makes the
callback fail loudly instead of guessing.

**Content-Security-Policy.** Built per request in `apps/frontend/middleware.ts` with a script nonce
(the static security headers stay in `next.config.js`). Adding a third-party script, iframe,
font/image host or API origin the browser talks to means updating the CSP directives in
`middleware.ts` — otherwise the browser silently blocks it (check the console for CSP violations).

### Supabase Auth → URL Configuration

- Site URL: `https://dev.expertly.network`
- Redirect URLs allow-list: `https://expertly.network/auth/callback`,
  `https://dev.expertly.network/auth/callback`

### DNS

- `expertly.network` → `A` record → `91.108.104.17` (apex domain — must be `A`, not `ALIAS`)

## Security & audit rollout (Oct 2026) — one-time steps

**Order matters: step 1 (database) before deploying the new backend.** The new API calls the
`member_directory_ids` function and the private `application-documents` bucket — deployed first,
`GET /v1/members` returns 500 and document uploads fail until the database is updated. Node ≥ 22.12
is required (the Docker images use `node:22-alpine`, which is current).

1. **Database** — (historical: this rollout predates go-live, when changes were folded into
   `supabase/migrations/0001`–`0004`. From 2026-11-09 every change is a new numbered migration —
   see `supabase/migrations/README.md`.) Bring an existing database up to date with a one-off, idempotent
   catch-up script run once in the SQL Editor (one transaction, `lock_timeout` 5 s — re-run if it
   times out), or rebuild it from the migrations. Needs pgvector ≥ 0.8.0
   (`select extversion from pg_extension where extname = 'vector';` — Supabase ships 0.8.x). The
   resulting schema:
   - removes direct Storage write access (backend-only writes), adds bucket size/type limits
     (`resource-assets` no longer takes `image/svg+xml` — replace `perks/logos/cleartax.svg` with a
     PNG before the bucket is ever restored into a fresh project), creates the private
     `application-documents` bucket;
   - updates the token hook (new `app_status` / `app_member_status` claims — replaced in place, no
     dashboard re-registration) and revokes the browser roles' direct table access;
   - lets `search_hybrid`'s vector channel use the HNSW index (`hnsw.ef_search = 100`,
     `hnsw.iterative_scan = relaxed_order`), adds `member_directory_ids` with trigram-indexed
     free-text matching;
   - hardens `handle_new_user` (`search_path = ''`; a signup with no email, or an email already on
     another profile, fails with a descriptive error in the Auth logs);
   - adds `updated_at` triggers on `categories`/`services`, CHECK constraints, composite/trigram/FK
     indexes, drops two unused indexes, rewrites RLS policies to `to authenticated` +
     `(select auth.uid())`.
2. **Legacy vetting documents** — documents uploaded before the private bucket existed sit under
   `members/application/…` in the public bucket. The API still signs them from there; the one-off
   script that moved them was removed (2026-11-07, pre-production — no real applicants yet).
3. **Backend env** (Coolify → backend app → Environment):
   - `CORS_ORIGINS` — comma-separated frontend origins, e.g.
     `https://expertly.network,https://www.expertly.network,https://dev.expertly.network`.
     **Required in production** — the API refuses to boot without it (see "Backend environment").
   - `SWAGGER_ENABLED=true` only if the interactive API docs at `/api` should stay reachable in
     production (off by default when `NODE_ENV=production`).
4. **Verify, then clean up** (SQL Editor):
   - `select policyname from pg_policies where schemaname = 'storage';` → expect **zero rows** (a
     policy added by hand in the dashboard isn't removed by the update).
   - `select count(*) from auth.users where email like '%@expertlyseed.test';` → expect **0**.
     The old dev-fixture seeds (removed from the repo 2026-10-31; still in git history) created
     50 fake members / 34 fake events with that email domain — delete them if a database has any.
   - Smoke-test AI search once (it exercises pgvector + the revoked function grants).
5. **Supabase Auth settings** (dashboard → Authentication), each one closes a takeover path:
   - **Confirm email: ON.** With auto-confirm, anyone can sign up with a member's email address
     (no mail ever reaches the owner); when the real member later signs in with LinkedIn — which
     returns the same verified email — Supabase links that identity into the attacker's account,
     and the attacker's password keeps working (account pre-hijacking). The sign-up form already
     handles the "check your email" path, so no code change is needed.
   - **Secure password change: ON** (require recent sign-in / reauthentication), so a stolen
     session can't silently set a new password.
   - Keep **manual identity linking** enabled only because the application wizard needs
     `linkIdentity()` (docs/auth.md Part 1b); after enabling Confirm email, test once that
     LinkedIn-connect still works for an email-confirmed account.
6. **Close the plain-HTTP Coolify panel.** `http://…:8000` (above) still answers; anyone on the
   network path can capture a dashboard login — and Coolify holds every production secret. Block
   port 8000 in the VPS firewall (ufw / Hostinger firewall) so the panel is only reachable through
   Traefik over TLS.
7. **Edge rate limit for public routes.** The API rate-limits signed-in users itself; anonymous
   traffic arrives through the Next.js server and is not counted there (see `docs/rest-api.md`
   "Rate limits"). Add a Traefik `rateLimit` middleware (or Cloudflare rule) on the **frontend**
   domains, keyed by client IP — e.g. `average: 20`, `burst: 60` per second.

### Verify the database update

`select proconfig from pg_proc where proname = 'search_hybrid';` lists the two
   `hnsw.*` settings; `select conname from pg_constraint where not convalidated;` → zero rows
   (or fix the reported rows); smoke-test AI search and the member directory search box.

### New database functions need an explicit GRANT

`0004_tables.sql` runs `alter default privileges for role postgres revoke
execute on functions from public` (globally) and from `anon`/`authenticated` (in `public`), and
grant `execute` on new functions to `service_role` only. So any function added later is callable by
the backend and nothing else: a function GoTrue must call (like `custom_access_token_hook`, run as
`supabase_auth_admin`) or one meant for the browser key needs an explicit
`grant execute on function … to <role>` in the same migration — otherwise it fails with
`permission denied for function` (for an auth hook: every login 500s). Trigger functions need no
grant.

## Manual operations reference

- **Force a redeploy without a code change**: Coolify UI → app → **Actions → Redeploy**, or
  `curl -X POST` the deploy webhook URL from that app's Webhooks settings page.
- **Container-level debugging**: Coolify → **Terminal** (left nav) gives a browser-based shell on
  the VPS or any of its containers — no SSH client needed. Useful commands:
  ```bash
  docker ps -a --filter ancestor=ghcr.io/expertly-network/growxq-frontend:latest \
    --format 'table {{.ID}}\t{{.Status}}\t{{.CreatedAt}}\t{{.Names}}'
  docker inspect <container-id> --format '{{json .Config.Labels}}' | tr ',' '\n' | grep -i traefik
  ```
  (Coolify container names are UUID-based, not literal app names — `--filter name=expertly-frontend`
  matches nothing; filter by `ancestor` (image) instead.)
- **Verify a deploy actually landed**:
  ```bash
  curl https://expertly.network
  curl https://dev.expertly.network
  curl https://api.expertly.network/v1/health
  curl https://dev-api.expertly.network/v1/health/ready   # 503 DATABASE_UNAVAILABLE = can't reach the DB
  ```

## GrowXQ rebrand — migration checklist (Oct 2026)

The product was renamed Expertly → GrowXQ (domain `growxq.com`). The code, package names
(`growxq-frontend`, `growxq-backend`, `@growxq/shared-types`) and CI image names
(`growxq-{backend,frontend}`) are renamed; everything below is infrastructure that has to be
moved by hand. Until it is, the live facts elsewhere in this file (Coolify app names, the
`expertly.network` domains, Supabase URLs) still describe the running setup.

1. **Before the first deploy of the rename:** point the Coolify apps (frontend, backend,
   search worker) at the new images `ghcr.io/expertly-network/growxq-{frontend,backend}:latest`
   — CI no longer pushes the old `expertly-*` tags, so they'd silently stay on the last old image.
2. **Set `API_URL` on the frontend app** in Coolify to the backend's public URL (today
   `https://api.expertly.network`; after DNS moves, the new API host), plus `SUPABASE_URL` /
   `SUPABASE_ANON_KEY`. Without them the frontend fails with the missing variable's name — there is
   no build-time fallback.
3. DNS: add the `growxq.com` (+ `www`, and the API/dev hosts you choose) records, then add those
   domains to the Coolify apps.
4. Update `API_URL` (step 2) to the new API host once its DNS resolves.
5. Supabase → Authentication → URL Configuration: Site URL → the new domain; add
   `https://<new domain>/auth/callback` (and the dev one) to the Redirect URLs allow-list.
   Supabase email templates (confirm signup, reset password) — replace any "Expertly" wording.
6. `NEXT_PUBLIC_SITE_URL` (frontend, runtime env) → the new domain(s), canonical first. Required in
   production: OAuth callbacks redirect only to these origins (and Open Graph link previews use the first).
7. LinkedIn: the footer still links to `linkedin.com/company/expertly-network` until a GrowXQ
   company page exists; the LinkedIn OAuth app's name/logo is set in the LinkedIn developer portal.
8. Mailbox: the site now shows `ask@growxq.com` (contact, event suggestions, suspended-account
   message) — make sure it receives mail.


## Email engine activation

Email content lives in Resend (templates); this backend queues and sends by template alias. The
email schema is in the migration files and already applied to the shared dev Supabase.

| Environment variable | Where | Behavior |
|---|---|---|
| `EMAIL_PROVIDER` | API + worker | `log` (default, simulated delivery) or `resend` |
| `EMAIL_WORKER_ENABLED` | worker | `false` by default; `true` only on the ONE worker that consumes this database's email queue |
| `RESEND_API_KEY` | API + worker | Required when provider is `resend`; backend secret only |
| `EMAIL_FROM` | API + worker | Required with Resend, e.g. `GrowXQ <insiders@growxq.com>`; overrides the template's sender; newline-free |
| `EMAIL_REPLY_TO` | API + worker | Defaults to `ask@growxq.com`; must be an email address |
| `SITE_URL` | API + worker | Required with Resend. This environment's public frontend URL — sent as the `SITE_URL` template variable, so template images/links resolve per environment |
| `RESEND_WEBHOOK_SECRET` | API | Signing secret of the Resend webhook; absent means the webhook returns 503 |
| `EMAIL_REDIRECT_TO` | local only | Sends every email to this address instead; forbidden when `NODE_ENV=production` |

**Shared database ownership:** a worker with `EMAIL_WORKER_ENABLED=true` consumes every queued
message in its database. Keep it `false` on local machines pointed at the shared dev database
while the dev worker is running, and keep exactly one consumer per Resend API key.

The worker ticks every five seconds, handles up to 50 messages per run, claims two at a time,
and spaces request starts by at least 550ms with at most two in flight. Each provider request
has a 10-second timeout. Retry delays are 1m, 5m, 30m, 2h; the fifth failure is terminal; provider
rejections fail immediately. Leases expire after five minutes; six expiries fail the message as
"delivery state unknown". Graceful shutdown waits for sends in flight. Hourly renewal scans use
UTC calendar dates. No recipient addresses, variable values, credentials or provider response
bodies are logged.

Setup per environment:

1. **Resend domain:** add the sending domain, publish its SPF/DKIM DNS records and wait for
   verification.
2. **Resend templates:** create and *publish* one template per automation with the alias it
   expects — `founding-seat-held`, `application-received`, `renewal-due-soon` — pasting the HTML
   and subject from `docs/email-templates/<alias>.html`. Declare the variables listed at the top
   of each file (give `NAME` a fallback such as `there`). A template edited later takes effect on
   the next send once republished.
3. **Environment:** set the variables above on the API and the worker. The template images are
   the frontend's `public/brand/email/*.png`, deployed with the frontend; confirm
   `<SITE_URL>/brand/email/logo-dark.png` loads.
4. **Webhook:** register `https://<api-domain>/v1/email/webhooks/resend` for `email.delivered`,
   `email.bounced`, `email.complained`; put its signing secret in `RESEND_WEBHOOK_SECRET` on the
   API. Keep request bodies unmodified through the proxy (signature validation uses the raw body).
5. **Verify:** submit an application with a test account. Its `email_messages` row should go
   `queued` → `sent` → `delivered` (`GET /v1/admin/email/messages` in Postman). A row that ends
   `failed` with `Resend HTTP 404/422` means the template isn't published or declares a variable
   the event doesn't send — fix it in Resend, then `POST /admin/email/messages/:id/retry`.
6. Review regular application and renewal copy in Resend before enabling those two automations
   (`PATCH /admin/email/automations/:key`).

Reliability limits: automatic queue keys deduplicate for the lifetime of the row. Resend's
send-idempotency cache lasts 24 hours. Webhooks for ids not yet recorded are acknowledged without a
status change (suppression still applies). Application submission intentionally succeeds even if
enqueue fails; monitor the corresponding error log.

Local verification: `pnpm --filter ./apps/backend test`, `pnpm typecheck`, and backend lint/build.
The queue/webhook SQL itself is exercised only against a real database (the dev Supabase) — the
unit tests mock it.

Provider references: [send API](https://resend.com/docs/api-reference/emails/send-email),
[webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[idempotency behavior](https://resend.com/docs/dashboard/emails/idempotency-keys).

## AI interviewer activation

ElevenLabs provides the voice; the backend is the interviewer (ElevenLabs calls it as a Custom
LLM on every turn). Contract: `docs/rest-api.md` "AI interviewer". The feature stays off (start →
503 `INTERVIEW_PROVIDER_UNAVAILABLE`) until every variable below is set.

| Environment variable | Where | Behavior |
|---|---|---|
| `ELEVENLABS_API_KEY` | API + worker | Mints conversation tokens (API) and downloads recordings (worker). Backend secret only |
| `ELEVENLABS_AGENT_ID` | API | The private interviewer agent |
| `ELEVENLABS_WEBHOOK_SECRET` | API | Post-call webhook signing secret |
| `ELEVENLABS_LLM_SECRET` | API | A random secret you generate and enter as the agent's Custom LLM API key; ElevenLabs sends it as a bearer token on every turn |
| `INTERVIEW_TURN_PROVIDER` / `_MODEL` / `_API_KEY` | API | Fast model for every spoken turn (e.g. `anthropic` / `claude-haiku-4-5-20251001`) |
| `INTERVIEW_REASONING_PROVIDER` / `_MODEL` / `_API_KEY` | API + worker | Planner, background analyst and post-call extractor (e.g. `anthropic` / `claude-sonnet-5`) |
| `INTERVIEW_CONSENT_VERSION` | API | Version of the consent copy shown before the call (default `2026-11-09`); bump when the copy changes |

These are independent of `AI_*` (article AI) and `OPENAI_*` (search): own providers, models and
keys, billed and rate-limited separately.

Setup per environment:

1. **Database:** apply `supabase/migrations/0007_ai_interviews.sql` (dev first, then production)
   **before** deploying a backend image that contains the interviews module.
2. **ElevenLabs agent** (ElevenLabs dashboard → Agents):
   - private agent (authentication required); voice and language (English) chosen after test calls;
   - first message: `Hi {{first_name}}, I'm the GrowXQ interviewer. This takes about 20 minutes. Shall we begin?`;
   - LLM → **Custom LLM**: URL `https://<api-domain>/v1/interviews/llm/chat/completions`, API key = `ELEVENLABS_LLM_SECRET`;
   - system tool `end_call` enabled; maximum conversation duration **30 minutes**;
   - Security → Overrides → enable **Custom LLM extra body** (the session token travels in it);
   - post-call webhook: **transcription only** → `https://<api-domain>/v1/interviews/webhooks/elevenlabs`; copy its secret into `ELEVENLABS_WEBHOOK_SECRET`. Don't enable the audio webhook (the worker downloads recordings instead);
   - conversation retention: the shortest available. Our own copies live in Supabase.
3. **Environment:** set the variables above on the API and the worker; restart both.
4. **Email:** publish the Resend template with alias `interview-drafts-ready` (variables `NAME`,
   `SITE_URL`), then enable the automation (`PATCH /v1/admin/email/automations/interview_drafts_ready`).
5. **Verify:** as a test member, take a short interview from `/dashboard/interview`. The interview
   should go `in_progress` → `processing` → `completed` within a few minutes, and
   `GET /v1/admin/interviews/:id` should show the transcript, audio URL and assessment.

The API must keep request bodies unmodified through the proxy: the webhook signature is checked
over the raw bytes. The custom-LLM endpoint streams Server-Sent Events, so the proxy must not
buffer responses for that path (Traefik's default is fine).
