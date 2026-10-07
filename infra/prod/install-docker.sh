#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID != 0 ]]; then
  printf 'Первичная настройка сервера требует root.\n' >&2
  exit 1
fi

mkdir -p /opt/template-monorepo
exec 8> /opt/template-monorepo/provision.lock
flock -w 300 8

if ! command -v docker >/dev/null; then
  # Пакеты из настроенных репозиториев Ubuntu; скрипты установки из сети не исполняются.
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    docker.io docker-compose-v2 ca-certificates curl openssl
fi

systemctl enable --now docker
docker info >/dev/null
docker compose version
command -v curl >/dev/null
command -v openssl >/dev/null
