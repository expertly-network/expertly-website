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
RUN pnpm --filter=expertly-backend run build
RUN pnpm --filter=expertly-backend deploy --prod /app/deploy

# --- runtime: plain node, no pnpm/corepack needed ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/deploy ./

EXPOSE 4000
CMD ["node", "dist/main.js"]
