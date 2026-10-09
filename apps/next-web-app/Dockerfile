# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/next-web-app/package.json apps/next-web-app/package.json
COPY packages/client-rest-api-sdk/package.json packages/client-rest-api-sdk/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter @oim/next-web-app...

COPY apps/next-web-app/src apps/next-web-app/src
COPY apps/next-web-app/tsconfig.json apps/next-web-app/next.config.ts apps/next-web-app/eslint.config.mjs apps/next-web-app/postcss.config.mjs apps/next-web-app/
COPY packages/client-rest-api-sdk/src packages/client-rest-api-sdk/src
COPY packages/client-rest-api-sdk/tsconfig.json packages/client-rest-api-sdk/tsconfig.json
COPY packages/typescript-config/*.json packages/typescript-config/

# Публичный путь фиксируется в браузерном bundle. Секреты сюда не передаются.
ARG NEXT_PUBLIC_CLIENT_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_CLIENT_API_URL=$NEXT_PUBLIC_CLIENT_API_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=1 \
    PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

RUN pnpm --filter @oim/client-rest-api-sdk run build \
    && pnpm --filter @oim/next-web-app run lint \
    && pnpm --filter @oim/next-web-app run check-types \
    && pnpm --filter @oim/next-web-app run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3005
WORKDIR /app

COPY --from=builder --chown=node:node /workspace/apps/next-web-app/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/apps/next-web-app/.next/static ./apps/next-web-app/.next/static

USER node
EXPOSE 3005
CMD ["node", "apps/next-web-app/server.js"]
