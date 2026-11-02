# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/react-admin-panel/package.json apps/react-admin-panel/package.json
COPY packages/admin-rest-api-sdk/package.json packages/admin-rest-api-sdk/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter @oim/react-admin-panel...

COPY apps/react-admin-panel apps/react-admin-panel
COPY packages/admin-rest-api-sdk packages/admin-rest-api-sdk
COPY packages/typescript-config packages/typescript-config

# Vite встраивает base в HTML, ресурсы и import.meta.env.BASE_URL.
RUN pnpm --filter @oim/admin-rest-api-sdk run build \
    && pnpm --filter @oim/react-admin-panel run check-types \
    && pnpm --filter @oim/react-admin-panel run lint \
    && pnpm --filter @oim/react-admin-panel exec vite build --base=/admin/

FROM caddy:2.11-alpine AS runtime

COPY infra/dokploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /workspace/apps/react-admin-panel/dist /srv/admin
RUN chown -R 1000:1000 /config /data

USER 1000:1000
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
