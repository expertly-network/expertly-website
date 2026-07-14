# Full-Stack Test Scaffold — Design

**Date:** 2026-07-14
**Status:** Approved by user, pending spec review

## Purpose

Stand up a minimal, working Next.js frontend + NestJS backend, each independently
dockerized, to prove the deployment path to Hostinger (build Docker image → run
container) works end-to-end before any real feature work begins. This is a
verification scaffold, not the production app.

Success criteria: the frontend page, when loaded, displays a message it fetched
live from the backend API — proving both services run and can reach each other,
not just that each boots independently.

## Architecture

- Single git repository (this one). Two fully independent top-level directories:
  `frontend/` (Next.js) and `backend/` (NestJS).
- No shared monorepo tooling (no workspaces, no turborepo) — each directory has
  its own `package.json` and lockfile, builds and runs as its own Docker image.
  This matches deploying two separate containers on Hostinger.
- Package manager: **pnpm** for both projects.
- Language: TypeScript throughout.

## Backend (NestJS)

- Single `AppModule` with two endpoints:
  - `GET /health` → `{ status: "ok", uptime: <seconds> }`
  - `GET /hello` → `{ message: "Hello from the backend!", timestamp: <ISO string> }`
- CORS enabled, allowing the frontend's origin to call the API.
- Listens on `process.env.PORT`, default `4000`.
- Config via `.env` (see `backend/.env.example`): `PORT`.

## Frontend (Next.js, App Router + Tailwind CSS)

- One page (`app/page.tsx`) that, on load, fetches the backend's `/hello`
  endpoint and renders the returned message and timestamp, plus a static
  "frontend is running" badge.
- Backend base URL comes from `NEXT_PUBLIC_API_URL` env var (see
  `frontend/.env.example`), e.g. `http://localhost:4000` locally. Kept
  configurable since exact Hostinger networking (subdomain vs host:port) isn't
  finalized yet.
- Listens on `process.env.PORT`, default `3000`.

## Docker

- One multi-stage `Dockerfile` per service, based on `node:20-alpine`, using
  pnpm. Each stage: install deps → build → copy build output into a lean
  runtime image. No docker-compose — each container is built and run
  independently, matching how they'll be deployed on Hostinger.
- `.dockerignore` per service to keep build context small (excludes
  `node_modules`, `.next`, `dist`, env files, etc.).

## Directory Structure

```
expertly-website/
├── README.md                  ← setup/run/deploy instructions
├── docs/superpowers/specs/    ← this design doc
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       └── globals.css
└── backend/
    ├── Dockerfile
    ├── .dockerignore
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── nest-cli.json
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── app.controller.ts
        └── app.service.ts
```

## Verification Plan

1. Local dev: run `pnpm install && pnpm dev` in each directory; confirm the
   frontend page renders the live `/hello` response from the backend.
2. Docker: build both images (`docker build`), run both containers with the
   frontend container's `NEXT_PUBLIC_API_URL` pointed at the backend
   container; confirm the same fetch succeeds cross-container.
3. `README.md` at repo root documents: prerequisites, local dev steps, Docker
   build/run commands per service, required env vars, and a Hostinger
   deployment section (build & push image, set `NEXT_PUBLIC_API_URL` and
   `PORT`).

## Out of Scope

- Authentication, database, business logic — this is a connectivity/deploy
  scaffold only.
- CI/CD pipeline automation.
- docker-compose / reverse proxy — deferred until Hostinger networking is
  decided.
