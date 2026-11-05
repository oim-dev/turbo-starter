# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/admin-rest-api-sdk/package.json packages/admin-rest-api-sdk/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter @oim/admin...

COPY apps/admin apps/admin
COPY packages/admin-rest-api-sdk packages/admin-rest-api-sdk
COPY packages/typescript-config packages/typescript-config

RUN pnpm --filter @oim/admin-rest-api-sdk run build \
    && pnpm --filter @oim/admin run lint \
    && pnpm --filter @oim/admin run check-types \
    && pnpm --filter @oim/admin run build

FROM nginx:alpine AS production

COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
