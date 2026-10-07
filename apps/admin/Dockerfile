FROM node:24-alpine AS base

RUN apk add --no-cache libc6-compat \
  && npm install --global pnpm@10.28.1 turbo@2.10.5

FROM base AS builder
WORKDIR /app

COPY . .

RUN turbo prune @biocad/admin --docker

FROM base AS installer
WORKDIR /app

ARG APP_ENV=development
ENV APP_ENV=$APP_ENV

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .

RUN pnpm turbo run build --filter=@biocad/admin

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN npm install --global serve@14.2.0

COPY --from=installer --chown=node:node /app/apps/admin/dist ./dist

USER node

EXPOSE 3001

CMD ["serve", "-s", "dist", "-l", "3001"]
