# Stage 1: builder — install deps and build web frontend
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install native build tools for better-sqlite3 (requires node-gyp)
RUN apk add --no-cache python3 make g++

# Copy workspace manifests first for layer caching
COPY package.json bun.lock bunfig.toml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN bun install

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build web frontend
RUN bun run --cwd apps/web build

# Stage 2: runtime — minimal image with API + built web assets
FROM oven/bun:1-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Reuse installed node_modules from builder (avoids lockfile drift in partial workspace copies)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy workspace manifests (needed for bun workspace resolution at runtime)
COPY package.json bun.lock bunfig.toml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy API source
COPY apps/api ./apps/api

# Copy built web assets from builder
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3456/health || exit 1

CMD ["bun", "run", "apps/api/src/index.ts"]
