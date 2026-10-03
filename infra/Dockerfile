# Standalone Docker build for the Mokosh API.
#
# This image does not need Nix — it resolves Node dependencies with npm inside
# the build, so `docker compose up` works on a laptop that has never heard of
# this flake. The Nix build in flake.nix produces the same environment via
# `nix build .#api`.

FROM node:22-slim-bookworm AS builder

WORKDIR /build

# Dependencies first so the layer caches across source edits.
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund

COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
# Migrations are applied at runtime by src/db/migrate.ts, so they have to ship.
COPY backend/drizzle ./drizzle

RUN npm run build


FROM node:22-slim-bookworm AS runtime

ENV NODE_ENV=production \
    PORT=8000

# curl is only here for the compose healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/mokosh

COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY backend/drizzle ./drizzle

RUN groupadd --system --gid 10001 mokosh \
    && useradd --system --uid 10001 --gid 10001 --create-home mokosh \
    && mkdir -p /var/lib/mokosh/evidence \
    && chown -R mokosh:mokosh /var/lib/mokosh

USER mokosh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

CMD ["node", "dist/server.js"]