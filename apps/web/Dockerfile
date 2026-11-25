FROM node:26 AS builder
RUN npm install -g pnpm@12
WORKDIR /app

COPY . .
RUN --mount=type=secret,id=web_env,target=/app/apps/web/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local --mount=type=cache,target=/pnpm-store pnpm install --store-dir /pnpm-store

ENV NODE_ENV=production
RUN --mount=type=secret,id=web_env,target=/app/apps/web/.env.local --mount=type=secret,id=server_env,target=/app/apps/server/.env.local cd apps/web && pnpm run build

FROM node:26-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app
# The SQLite database lives in a volume mounted at /data; the unprivileged user must own it.
RUN mkdir -p /data && chown node:node /data

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

# SSR chunks require workspace dependencies at runtime
WORKDIR /app/apps/web
# Run as the image's unprivileged user
USER node
# Apply pending migrations (idempotent), then start the server. A failed migration stops the
# container instead of serving an app with a stale schema.
CMD ["sh", "-c", "node ../../packages/db/scripts/migrate.mjs && exec node .output/server/index.mjs"]
