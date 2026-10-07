#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'Использование: bash deploy.sh sha-<40 hex> <registry/owner/repository> [registry-user]\n' >&2
  exit 1
fi

image_tag=$1
image_prefix=$2
registry_user=${3:-}
if [[ ! "$image_tag" =~ ^sha-[0-9a-f]{40}$ || ! "$image_prefix" =~ ^[a-z0-9][a-z0-9._:/-]+$ ]]; then
  printf 'Требуются полный SHA-тег и корректный IMAGE_PREFIX.\n' >&2
  exit 1
fi

release_dir=$(dirname "$(realpath "$0")")
deploy_root=${DEPLOY_ROOT:-/opt/template-monorepo}
project=${COMPOSE_PROJECT_NAME:-template-monorepo-prod}
auth_dir=
backup_file=
compose=()
stage=preflight

mkdir -p "$deploy_root/backups"
exec 9> "$deploy_root/deploy.lock"
if ! flock -n 9; then
  printf 'Другой деплой уже выполняется. Повторите запуск после его завершения.\n' >&2
  exit 1
fi

cleanup() {
  status=$?
  trap - EXIT
  if [[ $status != 0 ]]; then
    printf 'Деплой остановлен на этапе %s (код %s).\n' "$stage" "$status" >&2
    if [[ ${#compose[@]} != 0 ]]; then "${compose[@]}" ps >&2 || true; fi
    if [[ -n "$backup_file" ]]; then printf 'Дамп перед миграциями: %s\n' "$backup_file" >&2; fi
  fi
  if [[ -n "$auth_dir" ]]; then rm -rf "$auth_dir"; fi
  exit "$status"
}
trap cleanup EXIT

docker compose version

bash "$release_dir/init-env.sh" "$deploy_root/.env"
{
  printf 'IMAGE_PREFIX=%s\nIMAGE_TAG=%s\n' "$image_prefix" "$image_tag"
  printf 'CADDY_CONFIG_FILE=%s/Caddyfile\n' "$deploy_root"
} > "$release_dir/release.env"
compose=(docker compose --project-name "$project" --project-directory "$release_dir"
  --env-file "$deploy_root/.env" --env-file "$release_dir/release.env" -f "$release_dir/docker-compose.yml")
"${compose[@]}" --profile tools config --quiet

stage=registry-login
if [[ -n "$registry_user" ]]; then
  # Токен поступает по stdin SSH, не через аргументы процесса или Compose.
  auth_dir=$(mktemp -d "$deploy_root/.docker-auth.XXXXXX")
  export DOCKER_CONFIG=$auth_dir
  docker login "${image_prefix%%/*}" --username "$registry_user" --password-stdin
fi
stage=pull-applications
if ! "${compose[@]}" --profile tools pull --policy always client-api admin-api admin web-app migrations bootstrap-admin catalog-seed; then
  printf 'Для %s должны быть опубликованы backend, migrations, admin и web-app. Дождитесь успешного CI всей ревизии; latest вместо отсутствующего SHA не подставляется.\n' "$image_tag" >&2
  exit 1
fi

stage=pull-infrastructure
# Повторный деплой использует уже загруженную инфраструктуру без запросов к Docker Hub.
if ! "${compose[@]}" --profile tools pull --policy missing postgres minio minio-init caddy; then
  printf 'Не удалось загрузить отсутствующие образы инфраструктуры. Проверьте доступ к Docker Hub и его лимиты; при HTTP 429 нужны авторизация или предварительная загрузка образов.\n' >&2
  exit 1
fi

stage=caddy-validation
docker run --rm --pull never -v "$release_dir/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

stage=infrastructure
"${compose[@]}" up -d --pull never --wait --wait-timeout 180 postgres minio

stage=backup
backup_file="$deploy_root/backups/$(date -u +%Y%m%dT%H%M%SZ)-${image_tag}.dump"
"${compose[@]}" exec -T postgres sh -ec \
  "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc" > "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"

# Приложения обновляются только после успешных одноразовых задач.
stage=migrations
"${compose[@]}" run --rm --no-deps --pull never -T migrations
stage=storage
"${compose[@]}" run --rm --no-deps --pull never -T minio-init
stage=bootstrap
"${compose[@]}" run --rm --no-deps --pull never -T bootstrap-admin
stage=catalog
"${compose[@]}" run --rm --no-deps --pull never -T catalog-seed

stage=applications
"${compose[@]}" up -d --no-deps --pull never --wait --wait-timeout 180 client-api admin-api admin web-app

stage=caddy
if [[ -f "$deploy_root/Caddyfile" ]]; then
  cp "$deploy_root/Caddyfile" "$deploy_root/Caddyfile.previous"
fi
# Запись на месте сохраняет inode bind mount и позволяет reload без пересоздания контейнера.
cat "$release_dir/Caddyfile" > "$deploy_root/Caddyfile"
"${compose[@]}" up -d --no-deps --pull never --wait --wait-timeout 180 caddy
"${compose[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

wait_url() {
  local url=$1 expected=$2 status attempt
  for attempt in {1..30}; do
    status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --connect-timeout 5 --max-time 10 "$url") || status=000
    if [[ "$status" == "$expected" ]]; then
      printf '%s → HTTP %s\n' "$url" "$status"
      return 0
    fi
    printf 'Ожидаем %s: HTTP %s, попытка %s/30.\n' "$url" "$status" "$attempt" >&2
    sleep 3
  done
  printf '%s: ожидался HTTP %s, получен %s. Проверьте DNS, TLS и логи сервисов.\n' "$url" "$expected" "$status" >&2
  return 1
}

stage=https
wait_url https://demo-app.gromlab.ru/about 200
wait_url https://admin-demo-app.gromlab.ru/ 200
wait_url https://api-demo-app.gromlab.ru/categories 200
wait_url https://api-admin-demo-app.gromlab.ru/auth/me 401

"${compose[@]}" ps
printf 'release=%s\nimage_tag=%s\nimage_prefix=%s\n' "$release_dir" "$image_tag" "$image_prefix" > "$deploy_root/last-successful-deploy"
printf 'Деплой %s завершён. Окружение и первоначальный пароль admin: %s/.env\n' "$image_tag" "$deploy_root"
