# syntax=docker/dockerfile:1
#
# Build context is the repo root (pnpm workspace), not this folder:
#   docker build -f apps/frontend/Dockerfile .

FROM node:20-alpine AS base
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

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so they
# must be passed as build args:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
#                 --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
#                 --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx \
#                 -f apps/frontend/Dockerfile .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm --filter=expertly-frontend run build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# With a single root pnpm-lock.yaml, Next's output-file-tracing auto-detects
# the repo root as the workspace root and mirrors that path inside
# .next/standalone, hence "apps/frontend/..." destinations below, not "./".
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
