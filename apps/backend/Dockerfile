# syntax=docker/dockerfile:1
#
# Build context is the repo root (pnpm workspace), not this folder:
#   docker build -f apps/backend/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Only manifests copied here so this layer stays cached across source edits.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY package.json ./package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter=growxq-backend run build
RUN pnpm --filter=growxq-backend deploy --prod /app/deploy

# --- runtime: plain node, no pnpm/corepack needed ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/deploy ./

EXPOSE 4000
# One image, two Coolify apps: the API (default, `main`) and the search worker (APP_ENTRY=worker).
# Coolify's Docker Image apps have no start-command override, so the entry is picked by env var.
# `exec` keeps node as PID 1 so Coolify's SIGTERM reaches it (graceful shutdown).
CMD ["sh", "-c", "case \"${APP_ENTRY:-main}\" in main|worker) exec node \"dist/apps/backend/src/${APP_ENTRY:-main}.js\" ;; *) echo \"Unknown APP_ENTRY: $APP_ENTRY (expected main or worker)\" >&2; exit 1 ;; esac"]
