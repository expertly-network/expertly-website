# Expertly

A Next.js frontend + NestJS backend, each independently dockerized, backed by Supabase Auth.
See [`CLAUDE.md`](CLAUDE.md) for the full architecture and [`docs/auth.md`](docs/auth.md) for how
authentication/authorization work.

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

- Node.js 20+
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

## Deploying to Hostinger

The app is live at `https://expertly.network` (frontend) and
`https://api.expertly.network` (backend). DNS and HTTPS certificates are
already set up and do **not** need to be touched again for routine code
changes — only the steps below.

Every release, in order:

1. Commit and push to `main` on `expertly-network/expertly-website`.
   (Needs a token with `Contents: write` on this repo — a fine-grained GitHub
   token scoped to "Public repositories" only cannot push here; use a
   classic PAT with the `repo` scope.)

2. Build both production images **explicitly for `linux/amd64`** (the VPS's architecture —
   omitting `--platform` on an Apple Silicon Mac silently produces an `arm64` image that won't run
   on the server). Run these from the **repo root** — the build context is the whole workspace, not
   the individual service folder:
   ```bash
   docker build --platform linux/amd64 -t ghcr.io/cibi-m/expertly-backend:latest \
     -f apps/backend/Dockerfile .
   docker build --platform linux/amd64 -t ghcr.io/cibi-m/expertly-frontend:latest \
     --build-arg NEXT_PUBLIC_API_URL=https://api.expertly.network \
     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
     -f apps/frontend/Dockerfile .
   ```

3. Push both images to GHCR (needs a token with `write:packages`):
   ```bash
   docker push ghcr.io/cibi-m/expertly-backend:latest
   docker push ghcr.io/cibi-m/expertly-frontend:latest
   ```
   (Published under the `cibi-m` personal namespace, not `expertly-network`
   — creating a new package under an org's GHCR namespace needs org-member
   rights this account doesn't have as a repo-only collaborator. Both
   packages are public, so the VPS needs no registry login to pull them.)

4. SSH into the VPS and redeploy:
   ```bash
   cd /root/expertly-website
   curl -o docker-compose.prod.yml https://raw.githubusercontent.com/expertly-network/expertly-website/main/docker-compose.prod.yml
   docker compose -f docker-compose.prod.yml up -d
   ```
   This re-pulls the freshly-pushed `:latest` images and recreates whichever
   container(s) changed. (Hostinger's own Docker/Projects deploy feature is
   **not** used — it requires a special "Ubuntu with Docker" OS template
   this VPS isn't running; plain `docker compose` over SSH is the real
   mechanism.)

5. Verify:
   ```bash
   curl https://expertly.network
   curl https://api.expertly.network/v1/health
   curl https://api.expertly.network/v1/hello
   ```

Deployment itself is a fully manual flow by design — `.github/workflows/ci.yml` only typechecks
and builds on every push/PR to `main` (a merge gate, not a deploy trigger); no CD automation exists
yet.

## API Endpoints (backend)

All routes are under a `/v1` prefix. See [`docs/rest-api.md`](docs/rest-api.md) for the full,
current contract.

| Method | Path         | Response                                |
|--------|--------------|-------------------------------------------|
| GET    | `/v1/health` | `{ status: "ok", uptime: <seconds> }`    |
| GET    | `/v1/hello`  | `{ message: string, timestamp: string }` |
