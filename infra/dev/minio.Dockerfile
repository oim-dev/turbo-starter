# syntax=docker/dockerfile:1

FROM golang:1.24.2-alpine3.21 AS builder

RUN apk add --no-cache git
ENV CGO_ENABLED=0

RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go install -p 4 -trimpath -ldflags="-s -w" github.com/minio/minio@RELEASE.2025-04-22T22-12-26Z
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go install -p 4 -trimpath -ldflags="-s -w" github.com/minio/mc@RELEASE.2025-04-16T18-13-26Z

FROM alpine:3.21

RUN apk add --no-cache ca-certificates curl
COPY --from=builder /go/bin/minio /go/bin/mc /usr/local/bin/

ENTRYPOINT ["minio"]
