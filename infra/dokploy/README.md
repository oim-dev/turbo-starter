# Стенд в Dokploy

Тестовый стенд с полной production-сборкой монорепозитория через корневой
[`docker-compose.yml`](../../docker-compose.yml). Все публичные
сервисы доступны на одном домене по **HTTP** через Traefik Dokploy.
Внутри проекта Caddy слушает HTTP на порту **8080**, `auto_https` выключен.
Значения окружения в примере такие же простые, как в dev-режиме.

```text
Браузер → HTTP → Traefik Dokploy → gateway:8080 (Caddy)
                                    ├── /admin/          → файлы React SPA
                                    ├── /                → web:3000 (Next.js standalone)
                                    ├── /api/            → client-api:4000
                                    ├── /admin/api/      → admin-api:4001
                                    ├── /files/          → client-api:4000
                                    ├── /media/images/   → client-api:4000
                                    └── /default-bucket/ → minio:9000

API и image-worker → PostgreSQL, MinIO, RabbitMQ, imgproxy
```

`/default-bucket/` соответствует имени bucket из `S3_BUCKET`. Caddy удаляет префиксы
`/api` и `/admin/api` перед передачей запросов соответствующему API. Для S3
исходные путь, query и Host сохраняются: они участвуют в подписи запросов.
Bucket приватный; браузер загружает файлы по подписанным ссылкам.

## Состав

| Сервис | Запуск |
| --- | --- |
| `gateway` | Multi-stage сборка админки с Vite `base=/admin/`, затем Caddy с готовой статикой и SPA fallback |
| `web` | Существующий Dockerfile Next.js, standalone Node.js server |
| `client-api`, `admin-api`, `image-worker` | Существующий Dockerfile backend, отдельный Node.js-процесс на каждый entrypoint |
| `migrations` | Одноразовый `prisma migrate deploy` перед API и воркером |
| `postgres` | PostgreSQL 16, volume `postgres_data` |
| `minio` | Закреплённая версия MinIO, volume `minio_data` |
| `minio-init` | Одноразовое создание приватного bucket и lifecycle для незавершённых загрузок |
| `rabbitmq` | Очередь изображений, volume `rabbitmq_data` |
| `imgproxy` | Внутренняя обработка изображений |

Сборка запускает lint и проверку TypeScript для всех трёх приложений. Runtime
использует собранные артефакты. Caddyfile и статика включены в образ: bind mounts
из Git checkout для них не нужны. Имена контейнеров, сети и volumes определяются
Compose project name, поэтому разные стенды получают отдельные ресурсы.

## Настройка Dokploy

Порядок первого запуска: **получить и настроить домен → скопировать переменные и указать `PUBLIC_URL` → выполнить Deploy со сборкой**.

1. Создать **Docker Compose**-сервис в проекте, выбрать Git-репозиторий и ветку.
   Нужен режим **Compose**, поскольку здесь используются `build` и одноразовые
   зависимости `service_completed_successfully`.
2. Указать **Compose Path**: `docker-compose.yml`.
   Checkout должен содержать весь репозиторий: основной build context — корень.
   Dockerfile, Caddyfile и остальные файлы инфраструктуры находятся в `infra/dokploy`.
3. В **Domains → Add Domain** добавить выданный или сгенерированный домен.
   Если список сервисов пуст, нажать кнопку обновления **Fetch** рядом с выбором
   сервиса: Dokploy загрузит репозиторий и прочитает сервисы из Compose-файла.
   Предварительная сборка и заполнение **Environment** для появления списка
   не требуются. Указать настройки и сохранить домен:
   - Service: `gateway`;
   - Container port: `8080`;
   - Path: `/`;
   - Internal Path: `/`;
   - Strip Path: выключен;
   - HTTPS: выключен, без перенаправления на HTTPS.
4. Открыть [`infra/dokploy/.env.example`](.env.example), **скопировать всё содержимое**
   и вставить его в редактор раздела **Environment** этого Compose-сервиса.
   Заменить `PUBLIC_URL=http://stand.example.org` на `PUBLIC_URL=http://<выданный-домен>`:
   использовать домен из предыдущего шага, без пути и завершающего `/`, затем сохранить.
   Это единственное значение примера, которое требуется изменить для нового тестового
   стенда. Пароли, ключи и имена ресурсов уже заполнены, как в dev-режиме.
   Dokploy создаёт `.env` в корне checkout рядом с Compose-файлом; необходимые
   переменные явно передаются сервисам.
5. Проверить **Preview Compose**: `gateway` должен оставаться в сети `app`
   вместе с остальными сервисами и быть доступен Traefik через добавленную Dokploy
   сеть. Dokploy сам добавляет labels домена; вручную дублировать их не требуется.
6. Выполнить **Deploy** со сборкой образов. Сначала должны успешно завершиться
   `migrations` и `minio-init`, затем запуститься приложения. `Exited (0)` для этих
   двух одноразовых сервисов — ожидаемый результат.

Если домен добавлен или изменён после запуска, согласовать с ним `PUBLIC_URL`
и повторно выполнить **Deploy**: в режиме Docker Compose настройки маршрутизации
применяются при деплое.

Основной Compose не публикует host-порты. Внешняя точка входа — домен `gateway`.
Адреса БД, MinIO Console, RabbitMQ Management и imgproxy остаются внутри Docker-сети.

Официальная документация: [Compose](https://docs.dokploy.com/docs/core/docker-compose)
и [домены Compose](https://docs.dokploy.com/docs/core/docker-compose/domains),
включая [повторный деплой после изменения домена](https://docs.dokploy.com/docs/core/domains#docker-compose).

## Окружение

Общие параметры инфраструктуры совпадают с [`infra/dev/.env.example`](../dev/.env.example),
авторизация и лимиты изображений — с [`apps/backend/.env.example`](../../apps/backend/.env.example).
После первого запуска вход в админку: **`admin` / `admin`**.

- `PUBLIC_URL` — точный origin, например `http://stand.example.org`, без пути и
  завершающего `/`. Он используется для подписанных S3-ссылок и публичных файлов.
  Должен совпадать с HTTP-адресом из **Domains**, разрешаться и открываться также
  из контейнеров backend: серверные S3-операции используют этот публичный endpoint.
  Внутренний адрес `http://minio:9000` используется для подписанных ссылок источника imgproxy.
- `S3_BUCKET` — имя bucket и выделенный корневой URL-префикс. Рекомендуется
  оставить `default-bucket`; не использовать `admin`, `api`, `files`, `media`, `_next`
  или другие пути сайта. Изменение bucket не переносит существующие объекты.
- `CLIENT_JWT_SECRET` и `ADMIN_JWT_SECRET` — `client-secret` и `admin-secret`, как в dev.
- `BOOTSTRAP_ADMIN_PASSWORD` — `admin`, пароль пользователя `admin`, создаваемого на пустой
  БД. Изменение переменной при повторном деплое не меняет пароль существующего пользователя.
- `RABBITMQ_USER` и `RABBITMQ_PASSWORD` — `image` и `image-password`, как в dev;
  при изменении использовать URL-safe значения, поскольку они входят в AMQP URL.
- `IMGPROXY_KEY` и `IMGPROXY_SALT` — готовые dev-значения по 64 hex-символа из примера.

В браузерную сборку сайта передаётся только `/api`. Сервер Next.js обращается
к `http://client-api:4000`; секреты backend в frontend-образы не передаются.
Swagger в конфигурации стенда выключен.

На обычном HTTP-домене браузерные UUID создаются через `getRandomValues`,
SHA-256 изображений вычисляется через `hash-wasm`, а межвкладочная блокировка
авторизации использует IndexedDB при отсутствии Web Locks. Копирование ссылок
поддерживает HTTP через пользовательское действие и `execCommand('copy')`.

### Keycloak

При первом запуске доступен локальный вход. Для SSO в настройках админки
`/admin/management/keycloak` указать:

- Redirect URI: `http://<домен>/admin/api/auth/callback`;
- frontend callback: `http://<домен>/admin/auth/keycloak/callback`.

Redirect URI также зарегистрировать у клиента Keycloak. Начальные значения
в БД рассчитаны на локальную разработку и требуют замены при настройке стенда.

## Локальная проверка тех же образов

Из корня репозитория:

```bash
cp infra/dokploy/.env.example infra/dokploy/.env

PUBLIC_URL=http://dokploy.localhost:8080 docker compose \
  --env-file infra/dokploy/.env \
  -p turbo-starter-stand \
  -f docker-compose.yml \
  -f infra/dokploy/docker-compose.local.yml \
  up -d --build --wait --wait-timeout 180
```

Открыть `http://dokploy.localhost:8080/` и
`http://dokploy.localhost:8080/admin/`. Современные браузеры направляют
`*.localhost` на loopback; внутри Docker этот hostname является alias шлюза.
Так один и тот же S3 origin доступен браузеру и backend без изменения подписи.
Локальное дополнение публикует только `127.0.0.1:8080`.

Проверка через curl с явным разрешением hostname:

```bash
curl --resolve dokploy.localhost:8080:127.0.0.1 \
  http://dokploy.localhost:8080/healthz
```

Если порт 8080 занят, его нужно освободить или согласованно изменить порт Caddy,
публикацию порта, healthcheck и локальный `PUBLIC_URL`.

Последующие команды также выполняются из корня репозитория:

```bash
export PUBLIC_URL=http://dokploy.localhost:8080
export COMPOSE_PROJECT_NAME=turbo-starter-stand
export COMPOSE_FILE=docker-compose.yml:infra/dokploy/docker-compose.local.yml

docker compose --env-file infra/dokploy/.env ps -a
docker compose --env-file infra/dokploy/.env logs --tail=100 gateway web client-api admin-api image-worker
docker compose --env-file infra/dokploy/.env down
```

Обычный `down` сохраняет volumes. Для повторного запуска использовать тот же
project name. При деплое новой версии миграции применяются перед запуском API;
ошибка миграции блокирует запуск зависимых сервисов. Изменения паролей PostgreSQL
и RabbitMQ в `.env` сами по себе не обновляют credentials в существующих volumes.

## Проверка стенда после деплоя

1. `/` возвращает страницу Next.js, ресурсы `/_next/` загружаются.
2. `/admin` перенаправляет на `/admin/`; прямое открытие
   `/admin/management/users` и обновление страницы работают через SPA fallback.
3. Вход `admin` с `BOOTSTRAP_ADMIN_PASSWORD`, навигация и выход работают;
   запросы админки идут в `/admin/api/`.
4. Загрузка файла проходит через `/<S3_BUCKET>/`, завершение — через Admin API;
   публичная ссылка `/files/...` поддерживает скачивание и Range.
5. Загруженное изображение проходит обработку воркером, варианты открываются
   через `/media/images/...`.
6. Повторный Deploy сохраняет пользователей, файлы и очередь в volumes.

Healthcheck Caddy проверяет сам шлюз, Next.js — HTTP главной страницы,
Admin API — получение доступных способов входа из БД, Client API — ожидаемый
401 закрытого профиля. PostgreSQL, MinIO, RabbitMQ и imgproxy имеют собственные
проверки. Worker работает отдельным процессом; его обработку подтверждает
сценарий загрузки изображения.
