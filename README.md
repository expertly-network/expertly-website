# Expertly — Full-Stack Test Scaffold

A minimal Next.js frontend + NestJS backend, each independently dockerized, to
verify the deployment path to Hostinger (build image → run container) end to
end. The frontend fetches a live response from the backend on page load,
proving the two services can actually reach each other — not just that both
containers boot.

See [docs/superpowers/specs/2026-07-14-fullstack-test-scaffold-design.md](docs/superpowers/specs/2026-07-14-fullstack-test-scaffold-design.md)
for the full design rationale.

## Structure

```
expertly-website/
├── frontend/   Next.js (App Router, TypeScript, Tailwind CSS)
└── backend/    NestJS (TypeScript)
```

Each directory is fully independent — its own `package.json`, its own
`Dockerfile` — matching how they'll be deployed as two separate containers.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (`corepack enable` or `npm i -g pnpm`)
- Docker (only needed for the Docker steps below)

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

Full step-by-step explanation (for newcomers to this flow): see
[docs/deployment-guide-hostinger.md](docs/deployment-guide-hostinger.md).

Quick reference for every release:

1. Push your commit to `main` on `expertly-network/expertly-website`.
2. Build both production images:
   ```bash
   docker build -t ghcr.io/cibi-m/expertly-backend:latest ./backend
   docker build -t ghcr.io/cibi-m/expertly-frontend:latest \
     --build-arg NEXT_PUBLIC_API_URL=https://api.expertly.network \
     ./frontend
   ```
3. Push both images to GHCR:
   ```bash
   docker push ghcr.io/cibi-m/expertly-backend:latest
   docker push ghcr.io/cibi-m/expertly-frontend:latest
   ```

   (Images are published under the `cibi-m` personal namespace, not
   `expertly-network` — creating a brand-new package under an org's GHCR
   namespace requires org-member-level rights, which this account doesn't
   have as a repo-only collaborator.)
4. Deploy/redeploy `docker-compose.prod.yml` to the VPS (via the
   `hostinger-vps` MCP tool's `VPS_createNewProjectV1`, or manually through
   hPanel) — this pulls the freshly-pushed images and restarts containers.
5. Verify `https://expertly.network` and `https://api.expertly.network/health`.

This is a fully manual flow by design — no CI/CD automation exists yet.

## API Endpoints (backend)

| Method | Path      | Response                                |
|--------|-----------|------------------------------------------|
| GET    | `/health` | `{ status: "ok", uptime: <seconds> }`    |
| GET    | `/hello`  | `{ message: string, timestamp: string }` |
