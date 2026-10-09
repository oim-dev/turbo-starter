# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/nest-backend/package.json apps/nest-backend/package.json
RUN pnpm install --filter @oim/nest-backend... --frozen-lockfile
COPY apps/nest-backend apps/nest-backend
RUN pnpm --filter @oim/nest-backend check-types && pnpm --filter @oim/nest-backend lint && pnpm --filter @oim/nest-backend build

FROM build AS production-dependencies
RUN pnpm --filter @oim/nest-backend deploy --prod --legacy /out/backend

# Prisma tooling и исходники конфигурации нужны только одноразовым миграциям.
FROM base AS migrations
ENV NODE_ENV=production \
    CHECKPOINT_DISABLE=1
WORKDIR /app
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/nest-backend ./apps/nest-backend
WORKDIR /app/apps/nest-backend
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS runtime
ENV NODE_ENV=production \
    CLIENT_API_HOST=0.0.0.0 \
    ADMIN_API_HOST=0.0.0.0
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /out/backend ./
USER node
EXPOSE 3001 3002
CMD ["node", "dist/client-api/main.js"]
