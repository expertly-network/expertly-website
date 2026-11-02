# syntax=docker/dockerfile:1
#
# Build context is the repo root (pnpm workspace), not this folder:
#   docker build -f apps/frontend/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY package.json ./package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .

# No build args: the image carries no deployment config. API_URL, SUPABASE_URL and
# SUPABASE_ANON_KEY are runtime env vars on the container (see apps/frontend/.env.example), so the
# same image runs dev and production.
RUN pnpm --filter=growxq-frontend run build

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# With a single root pnpm-lock.yaml, Next's output-file-tracing auto-detects
# the repo root as the workspace root and mirrors that path inside
# .next/standalone, hence "apps/frontend/..." destinations below, not "./".
COPY --from=build --chown=node:node /app/apps/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/frontend/.next/static ./apps/frontend/.next/static
# standalone output doesn't include public/ — without it /fonts/pdf/*.ttf 404s and the profile
# PDF export fails on font load.
COPY --from=build --chown=node:node /app/apps/frontend/public ./apps/frontend/public

# Never run as root: the official image ships an unprivileged `node` user (it owns the app files,
# so Next can still write its runtime cache under .next/).
USER node
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
