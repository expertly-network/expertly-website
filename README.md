# Expertly

A Next.js frontend + NestJS backend, each independently dockerized, backed by Supabase Auth.
See [`CLAUDE.md`](CLAUDE.md) for the full architecture, [`docs/auth.md`](docs/auth.md) for how
authentication/authorization work, and [`docs/deployment.md`](docs/deployment.md) for how
deploys/CI/Coolify work.

## Structure

```
expertly-website/
├── apps/
│   ├── frontend/           Next.js (App Router, TypeScript, Tailwind CSS)
│   └── backend/            NestJS (TypeScript)
├── packages/
│   └── shared-types/       compiler-enforced request/response types shared by both apps
└── design/                 git submodule — UI mockups (expertly-network/expertly-portal-design)
```

A single pnpm workspace (root `pnpm-workspace.yaml`, one `pnpm-lock.yaml`) ties `apps/`/`packages/`
together via [Turborepo](https://turbo.build/); `apps/frontend/`/`apps/backend/` still each have
their own `package.json` and `Dockerfile`, matching how they're deployed as two separate
containers.

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) (`corepack enable` — this repo pins `pnpm@9.15.0` via the root
  `package.json`'s `packageManager` field, so corepack will fetch the right version automatically)
- Docker (only needed for the Docker steps below)

## Getting the code

`design/` is a git submodule, not pulled in by a plain `git clone`:

```bash
git clone --recurse-submodules https://github.com/expertly-network/expertly-website.git
# or, if already cloned without that flag:
git submodule update --init
```

## Local development

Install once at the repo root — this installs both services and links `shared-types` between
them:
```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
pnpm install
```

Then either run both at once:
```bash
pnpm dev
```
or run just one, each in its own terminal:
```bash
pnpm --filter ./apps/backend dev    # http://localhost:4000
pnpm --filter ./apps/frontend dev   # http://localhost:3000
```

Open http://localhost:3000 — you should see "Frontend is running" and a
message fetched live from the backend's `/hello` endpoint.

`pnpm typecheck` / `pnpm build` (also root-level, via Turbo) run `tsc --noEmit` / the production
build for both services.

## Running with Docker

Each service still builds and runs as an independent container, but the build now needs the whole
workspace as context (so it can see the root lockfile and `packages/shared-types/`) — run these
from the **repo root**, not from inside `apps/backend/`/`apps/frontend/`.

**Backend:**
```bash
docker build -t expertly-backend -f apps/backend/Dockerfile .
docker run -d --rm --name expertly-backend -p 4000:4000 expertly-backend
```

**Frontend:**

`NEXT_PUBLIC_*` vars are inlined into the frontend's JavaScript bundle at *build* time (they run in
the browser, not on the server), so they must be passed as build args, not just runtime `-e` flags:

```bash
docker build -t expertly-frontend -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  .
docker run -d --rm --name expertly-frontend -p 3000:3000 expertly-frontend
```

Visit http://localhost:3000 to confirm the same connectivity works
cross-container.

Stop both with `docker stop expertly-backend expertly-frontend`.

### Using docker compose

A single root `docker-compose.yml` builds and runs both containers, each still from its own
`Dockerfile` (`apps/backend/Dockerfile`, `apps/frontend/Dockerfile`) but both built with the repo
root as context — the compose file just orchestrates them together, it doesn't merge the services.

```bash
cp .env.example .env                      # NEXT_PUBLIC_* vars used at build time
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
docker compose up -d --build
```

Visit http://localhost:3000 to confirm connectivity. Stop with
`docker compose down`.

If you change any `NEXT_PUBLIC_*` var in the root `.env`, re-run with `--build` since they're
baked into the frontend at image build time.

## Deploying (dev environment)

**This section covers the `dev` Coolify environment only — production deployment hasn't been set
up yet and will get its own documentation when it is.** The app runs on a Hostinger VPS via
[Coolify](https://coolify.io) (dashboard: `http://shreyansmaloo.site:8000`), currently reachable at
`https://dev.expertly.network` (frontend) / `https://dev-api.expertly.network` (backend). As an
interim arrangement the production domain names (`expertly.network`, `api.expertly.network`) are
also routed to these same dev-environment containers for now — see the scope note at the top of
[`docs/deployment.md`](docs/deployment.md) before assuming production is live.

One frontend image and one backend image serve every domain currently configured (the frontend
resolves its API URL at runtime from the request's hostname — see `docs/deployment.md`), so
there's no separate `:dev` build to maintain.

**Deploys are fully automatic**: every push to `main` runs `.github/workflows/ci.yml`, which
lints, typechecks, and builds (the merge gate) — then, only if that passes, builds both Docker
images, pushes them to `ghcr.io/expertly-network/expertly-{backend,frontend}:latest`, and calls
Coolify's deploy API to redeploy both apps with the new images. No manual steps, no SSH, no
`docker compose` needed.

To verify a deploy landed:
```bash
curl https://expertly.network
curl https://dev.expertly.network
curl https://api.expertly.network/v1/health
curl https://dev-api.expertly.network/v1/health
```

To force a redeploy without a code change, or to change any Coolify/DNS/healthcheck/CI-secrets
config, see **[`docs/deployment.md`](docs/deployment.md)** — the full reference, including the
required GitHub secrets, known gotchas (a healthcheck footgun, an OAuth-redirect bug, a Node
version requirement), and manual-operations commands.

## API Endpoints (backend)

All routes are under a `/v1` prefix. See [`docs/rest-api.md`](docs/rest-api.md) for the full,
current contract.

| Method | Path         | Response                                |
|--------|--------------|-------------------------------------------|
| GET    | `/v1/health` | `{ status: "ok", uptime: <seconds> }`    |
| GET    | `/v1/hello`  | `{ message: string, timestamp: string }` |
