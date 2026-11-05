# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/client-rest-api-sdk/package.json packages/client-rest-api-sdk/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter @oim/web...

COPY apps/web/src apps/web/src
COPY apps/web/tsconfig.json apps/web/next.config.ts apps/web/eslint.config.mjs apps/web/postcss.config.mjs apps/web/
COPY packages/client-rest-api-sdk/src packages/client-rest-api-sdk/src
COPY packages/client-rest-api-sdk/tsconfig.json packages/client-rest-api-sdk/tsconfig.json
COPY packages/typescript-config/*.json packages/typescript-config/

# Публичный путь фиксируется в браузерном bundle. Секреты сюда не передаются.
ARG NEXT_PUBLIC_CLIENT_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_CLIENT_API_URL=$NEXT_PUBLIC_CLIENT_API_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=1

RUN pnpm --filter @oim/client-rest-api-sdk run build \
    && pnpm --filter @oim/web run lint \
    && pnpm --filter @oim/web run check-types \
    && pnpm --filter @oim/web run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY --from=builder --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
