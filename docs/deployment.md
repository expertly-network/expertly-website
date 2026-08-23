# Expertly — Deployment Reference (Coolify, dev environment)

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
`http://shreyansmaloo.site:8000`. Traefik is Coolify's built-in reverse proxy/TLS terminator
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
| `expertly-backend` | `/v1/health` | `AppController.getHealth()` — note the `/v1` global prefix; `/health` alone 404s |
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
| `expertly-backend` | `ghcr.io/expertly-network/expertly-backend:latest` | `api.expertly.network`, `dev-api.expertly.network` |
| `expertly-frontend` | `ghcr.io/expertly-network/expertly-frontend:latest` | `expertly.network`, `www.expertly.network`, `dev.expertly.network`, `www.dev.expertly.network` |

This was a deliberate choice over building separate `:dev`/`:prod` images: `NEXT_PUBLIC_*` env vars
are inlined into the frontend's client bundle at `next build` time, so they can't be swapped per
environment at container-start time the way a normal env var can. Building two images just to get
two different `NEXT_PUBLIC_API_URL` values would also mean two build pipelines and two things to
keep in sync. Instead, the single frontend image resolves its API base URL **at runtime, from the
request's hostname**:

- `apps/frontend/lib/api/base-url.shared.ts` — the `API_HOSTS` map (hostname → API origin) and a
  `FALLBACK_API_URL`.
- `apps/frontend/lib/api/base-url.client.ts` — reads `window.location.hostname` (browser-side
  calls, e.g. `apiFetch` in `lib/api/client.ts`).
- `apps/frontend/lib/api/base-url.server.ts` — reads the `host` header via `next/headers`
  (Server Components / Route Handlers, e.g. `lib/api/server.ts`). Kept in a **separate file** from
  the client version deliberately — importing `next/headers` anywhere reachable from a
  Client Component bundle breaks the Next.js build ("You're importing a component that needs
  next/headers... not supported in the pages/ directory"), even if the import is unused on that
  code path.

Adding a third domain (e.g. a staging environment) means adding one entry to `API_HOSTS`, not a
new image or a new Coolify app.

## CI/CD pipeline

`.github/workflows/ci.yml`, on every push to `main`:

1. **Lint, Typecheck & Build** (`pnpm lint` → `pnpm typecheck` → `pnpm build` via Turborepo) — the
   merge gate.
2. **Build & Push Docker Images** (only runs if step 1 passes, and only on `push` to `main`, not
   on PRs) — builds both Dockerfiles for `linux/amd64` and pushes
   `ghcr.io/expertly-network/expertly-{backend,frontend}:latest`, authenticated with the
   workflow's own `GITHUB_TOKEN` (no PAT needed — GHCR under the repo's own org needs nothing
   extra). Frontend build-args (`NEXT_PUBLIC_*`) come from repo secrets — see below.
3. **Trigger Coolify redeploy** — the last step of the same job. Since Coolify's apps here are
   prebuilt-image resources rather than git-triggered builds, Coolify's own git-source webhooks
   (GitHub/GitLab/etc., visible under each app's *Webhooks* settings page) don't apply — those
   exist for apps Coolify builds from a repo checkout. Instead this step `curl`s Coolify's generic
   API deploy endpoint directly:
   ```bash
   curl -X POST "http://91.108.104.17:8000/api/v1/deploy?uuid=<backend-uuid>,<frontend-uuid>&force=true" \
     -H "Authorization: Bearer <token>"
   ```
   `uuid` accepts a **comma-separated list** — one call redeploys both apps. Note it's `POST`, not
   `GET` (the API used to be `GET`; Coolify returns a `405` with a "this endpoint has changed to a
   POST request" body if you use the old verb — easy to hit if copying older Coolify docs/examples).

   **Use `force=true`, not `force=false`.** Both images are pushed to the same `:latest` tag, and
   `force=false` was observed to let this step return success while Coolify silently skipped the
   actual re-pull/restart — the CI step showed green but the running container kept serving a
   build from well before that push. `force=true` always re-pulls and restarts.

   Each app's deploy-webhook URL/UUID is on its **Settings → Webhooks** page ("Deploy webhook"
   section, distinct from the "Manual Git webhooks" section below it).

So: push to `main` → lint/typecheck/build gate → both images rebuilt and pushed → Coolify
redeploys both apps with the new images. Fully automatic, no manual "Redeploy" click needed.

### Required GitHub Actions secrets (repo `expertly-network/expertly-website`)

| Secret | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Frontend build-arg fallback (used pre-runtime-resolution / non-matched hosts) |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend build-arg — baked into the client bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend build-arg — baked into the client bundle (public-by-design, safe to bake in) |
| `COOLIFY_API_TOKEN` | Bearer token for the deploy-trigger step. Created under Coolify → **Keys & Tokens → API Tokens**, scoped to the `Deploy` permission only (least privilege — it can't read/write anything else). **Expires 2027-08-18** — needs manual rotation before then, since an expired token fails the deploy step silently-ish (the `curl` will just 401). |
| `COOLIFY_BACKEND_DEPLOY_UUID` | `expertly-backend`'s Coolify app UUID (`pyb3wjiep9opemlwduxj8j2i`) |
| `COOLIFY_FRONTEND_DEPLOY_UUID` | `expertly-frontend`'s Coolify app UUID (`km7kyiq8xt7dn6al3fw3e0sm`) |

The three `NEXT_PUBLIC_*` secrets must be set for the frontend to work: the Dockerfile has a
fallback default for the API URL only, so an unset Supabase URL/key still builds successfully but
fails at container **runtime** with `Error: Your project's URL and Key are required to create a
Supabase client!`.

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
| Path | `/` | `/v1/health` |
| Method | `GET` | `GET` |
| Scheme | `HTTP` | `HTTP` |
| Expected code | `200` | `200` |
| Interval | `5s` | `5s` |
| Timeout | `10s` | `10s` |
| Retries | `10` | `10` |
| Start period | `20s` | `20s` |

### Server-side origin resolution

Any server-side code that needs "the current public URL" (OAuth callbacks, absolute redirects,
etc.) must derive it from forwarded headers, never from `request.url`/`req.url`:
```ts
const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
const proto = request.headers.get('x-forwarded-proto') ?? 'https';
const origin = `${proto}://${host}`;
```
Reference implementations: `apps/frontend/app/auth/callback/route.ts`,
`apps/frontend/lib/api/base-url.server.ts`.

### Supabase Auth → URL Configuration

- Site URL: `https://dev.expertly.network`
- Redirect URLs allow-list: `https://expertly.network/auth/callback`,
  `https://dev.expertly.network/auth/callback`

### DNS

- `expertly.network` → `A` record → `91.108.104.17` (apex domain — must be `A`, not `ALIAS`)

## Manual operations reference

- **Force a redeploy without a code change**: Coolify UI → app → **Actions → Redeploy**, or
  `curl -X POST` the deploy webhook URL from that app's Webhooks settings page.
- **Container-level debugging**: Coolify → **Terminal** (left nav) gives a browser-based shell on
  the VPS or any of its containers — no SSH client needed. Useful commands:
  ```bash
  docker ps -a --filter ancestor=ghcr.io/expertly-network/expertly-frontend:latest \
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
  curl https://dev-api.expertly.network/v1/health
  ```
