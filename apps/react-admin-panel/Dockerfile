# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/react-admin-panel/package.json apps/react-admin-panel/package.json
COPY packages/admin-rest-api-sdk/package.json packages/admin-rest-api-sdk/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter @repo/react-admin-panel...

COPY apps/react-admin-panel apps/react-admin-panel
COPY packages/admin-rest-api-sdk packages/admin-rest-api-sdk
COPY packages/typescript-config packages/typescript-config

ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
RUN pnpm --filter @demo/admin-rest-api-sdk run build \
    && pnpm --filter @repo/react-admin-panel run lint \
    && pnpm --filter @repo/react-admin-panel run check-types \
    && pnpm --filter @repo/react-admin-panel run build

FROM nginx:alpine AS production

COPY --from=builder /app/apps/react-admin-panel/dist /usr/share/nginx/html
COPY apps/react-admin-panel/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
