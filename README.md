# Expertly

A Next.js frontend + NestJS backend, each independently dockerized, backed by Supabase Auth.
See [`CLAUDE.md`](CLAUDE.md) for the full architecture and [`docs/auth.md`](docs/auth.md) for how
authentication/authorization work.

## Structure

```
expertly-website/
├── frontend/   Next.js (App Router, TypeScript, Tailwind CSS)
├── backend/    NestJS (TypeScript)
└── design/     git submodule — UI mockups (expertly-network/expertly-portal-design)
```

Each of `frontend/`/`backend/` is fully independent — its own `package.json`, its own
`Dockerfile` — matching how they'll be deployed as two separate containers.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (`corepack enable` or `npm i -g pnpm`)
- Docker (only needed for the Docker steps below)

## Getting the code

`design/` is a git submodule, not pulled in by a plain `git clone`:

```bash
git clone --recurse-submodules https://github.com/expertly-network/expertly-website.git
# or, if already cloned without that flag:
git submodule update --init
```

## Local development

Run each service in its own terminal.

**Backend** (http://localhost:4000):
```bash
cd backend
cp .env.example .env
pnpm install
pnpm dev
```

**Frontend** (http://localhost:3000):
```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev
```

Open http://localhost:3000 — you should see "Frontend is running" and a
message fetched live from the backend's `/hello` endpoint.

## Running with Docker

Each service builds and runs as an independent container.

**Backend:**
```bash
cd backend
docker build -t expertly-backend .
docker run -d --rm --name expertly-backend -p 4000:4000 expertly-backend
```

**Frontend:**

`NEXT_PUBLIC_API_URL` is inlined into the frontend's JavaScript bundle at
*build* time (it runs in the browser, not on the server), so it must be
passed as a build arg, not just a runtime `-e` flag:

```bash
cd frontend
docker build -t expertly-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 .
docker run -d --rm --name expertly-frontend -p 3000:3000 expertly-frontend
```

Visit http://localhost:3000 to confirm the same connectivity works
cross-container.

Stop both with `docker stop expertly-backend expertly-frontend`.

### Using docker compose

A single root `docker-compose.yml` builds and runs both containers, each
still from its own `Dockerfile` (`./backend`, `./frontend`) — the compose
file just orchestrates them together, it doesn't merge the services.

```bash
cp .env.example .env          # sets NEXT_PUBLIC_API_URL used at build time
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d --build
```

Visit http://localhost:3000 to confirm connectivity. Stop with
`docker compose down`.

If you change `NEXT_PUBLIC_API_URL` in the root `.env`, re-run with
`--build` since it's baked into the frontend at image build time.

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

2. Build both production images **explicitly for `linux/amd64`** (the VPS's
   architecture — omitting `--platform` on an Apple Silicon Mac silently
   produces an `arm64` image that won't run on the server):
   ```bash
   docker build --platform linux/amd64 -t ghcr.io/cibi-m/expertly-backend:latest ./backend
   docker build --platform linux/amd64 -t ghcr.io/cibi-m/expertly-frontend:latest \
     --build-arg NEXT_PUBLIC_API_URL=https://api.expertly.network \
     ./frontend
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

This is a fully manual flow by design — no CI/CD automation exists yet.

## API Endpoints (backend)

All routes are under a `/v1` prefix. See [`docs/rest-api.md`](docs/rest-api.md) for the full,
current contract.

| Method | Path         | Response                                |
|--------|--------------|-------------------------------------------|
| GET    | `/v1/health` | `{ status: "ok", uptime: <seconds> }`    |
| GET    | `/v1/hello`  | `{ message: string, timestamp: string }` |
