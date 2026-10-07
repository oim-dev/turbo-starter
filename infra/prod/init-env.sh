#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# != 1 ]]; then
  printf 'Использование: bash init-env.sh /absolute/path/.env\n' >&2
  exit 1
fi

env_file=$1
exec 8> "$env_file.lock"
flock 8
if [[ -e "$env_file" ]]; then
  # Дополняет окружение предыдущих релизов без замены существующих паролей.
  if ! grep -Eq '^[[:space:]]*CATALOG_OWNER_PASSWORD[[:space:]]*=' "$env_file"; then
    secret=$(openssl rand -hex 32)
    printf '\nCATALOG_OWNER_PASSWORD=%s\n' "$secret" >> "$env_file"
  fi
  printf 'Используется существующее окружение: %s\n' "$env_file"
  exit 0
fi

# Готовый файл публикуется атомарно, без перезаписи существующего окружения.
temp_file=$(mktemp "$(dirname "$env_file")/.env.XXXXXX")
trap 'rm -f "$temp_file"' EXIT
{
  printf 'POSTGRES_USER=demo\nPOSTGRES_DB=demo\nMINIO_ROOT_USER=demo-root\nS3_ACCESS_KEY=demo-app\n'
  for key in POSTGRES_PASSWORD CLIENT_JWT_SECRET ADMIN_JWT_SECRET MINIO_ROOT_PASSWORD S3_SECRET_KEY BOOTSTRAP_ADMIN_PASSWORD CATALOG_OWNER_PASSWORD; do
    secret=$(openssl rand -hex 32)
    printf '%s=%s\n' "$key" "$secret"
  done
} > "$temp_file"
ln "$temp_file" "$env_file"

printf 'Создано окружение %s. Секреты сохранены только в этом файле.\n' "$env_file"
