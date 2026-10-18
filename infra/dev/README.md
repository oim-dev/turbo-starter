# Локальная инфраструктура

Docker Compose запускает PostgreSQL 16, а профиль `images` добавляет MinIO,
инициализацию приватного bucket, RabbitMQ 4 management и imgproxy. NestJS API,
воркер изображений и клиентские приложения работают локальными процессами на host.
Все команды ниже выполняются из корня репозитория. Опубликованные порты привязаны
к `127.0.0.1`.

## База данных

При необходимости скопируйте `infra/dev/.env.example` в `infra/dev/.env` и задайте
свои значения. `env.example` — идентичная совместимая копия шаблона.
Рабочий `.env` повторяет структуру примера, отличаться могут только значения.
Без файла используются значения из примера.

```sh
pnpm infra:dev:up
```

По умолчанию PostgreSQL доступен по адресу `localhost:5544`, база — `default-db`,
пользователь — `user`, пароль — `password`.
Backend читает `POSTGRES_*` из `infra/dev/.env`; окружение процесса и
`apps/nest-backend/.env` имеют приоритет. `POSTGRES_HOST` по умолчанию — `localhost`.
Строка подключения собирается в backend; отдельная переменная `DATABASE_URL` не нужна.
Если у вас сохранился `.env` из другого проекта, согласуйте его значения с
`apps/nest-backend/.env`: существующие файлы окружения не перезаписываются.

Подготовка схемы:

```sh
pnpm backend:prisma:generate
pnpm backend:prisma:deploy
```

После миграций запустите `pnpm backend:dev`: Admin API автоматически создаст
владельца `admin/admin`, если административных аккаунтов ещё нет. Отдельного CLI/seed нет.

Оба API используют Bearer JWT на 7 дней без refresh; срок сессии равен сроку JWT.
CORS разрешает любой origin, поэтому при смене адреса UI allowlist не нужен.
TTL и origins не задаются через env. Настройки auth описаны в
[`apps/nest-backend/.env.example`](../../apps/nest-backend/.env.example).
Все настройки Keycloak задаются через админку и хранятся в БД. Secure временных
OIDC cookies определяется callback URL, SameSite фиксирован Lax.

Имя проекта задаётся `COMPOSE_PROJECT_NAME` в `infra/dev/.env`, по умолчанию —
`turbo-starter-dev`. `MINIO_IMAGE` и `MINIO_INIT_IMAGE` задают теги собираемых образов.
Данные PostgreSQL, MinIO и RabbitMQ
сохраняются в отдельных именованных volumes. Команды остановки не удаляют данные:

```sh
pnpm infra:dev:logs
pnpm infra:dev:down
```

Изолированные копии полного проекта создаются командами worktree, описанными в Relay
`DOC-14` «Изолированные worktree-окружения». Они согласованно заполняют env-файлы
инфраструктуры и приложений, выделяют порты и отдельные Docker volumes.

## Необязательное S3-хранилище

Профиль `storage` запускает MinIO отдельно от очереди и обработчика изображений.

Образ MinIO собирается автоматически из закреплённых исходников MinIO и `mc`
через `minio.Dockerfile`: публичные community-образы больше не распространяются.
Первая сборка загружает Go-зависимости; последующие используют Docker build cache.
Устанавливать Go на рабочую машину не требуется.

```sh
pnpm infra:dev:storage
```

Команда дожидается готовности MinIO, идемпотентно создаёт bucket и устанавливает
`mc anonymous set none`. Для документов добавляет отдельное lifecycle-правило
`files/staging/`: текущие и нетекущие версии временных объектов истекают через
сутки. Повторный init не дублирует правило и сохраняет остальные правила bucket.
Постоянные `files/objects/` этим правилом не охватываются. Настройки:

| Параметр                  | По умолчанию                 |
| ------------------------- | ---------------------------- |
| S3 API                    | `http://localhost:9000`      |
| Консоль MinIO             | `http://localhost:9001`      |
| Access key                | `user`                       |
| Secret key для разработки | `password`                   |
| Bucket                    | `default-bucket`             |
| Регион                    | `us-east-1`                  |

### Загрузка из браузера и CORS

Браузер отправляет исходный файл напрямую в MinIO по presigned **PUT**, выданному
backend. `S3_ENDPOINT=http://localhost:9000` в backend задаёт адрес для браузера и
S3-операций host-процессов. Клиент использует выданные URL и заголовки без замены
hostname или порта: они участвуют в подписи. Доступ к объектам требует подписи;
CORS не предоставляет анонимное чтение или запись.

В закреплённом `minio.Dockerfile` используется MinIO
`RELEASE.2025-04-22T22-12-26Z`. Его bucket CORS API — заглушка, поэтому применяется
реальная серверная настройка `MINIO_API_CORS_ALLOW_ORIGIN` из
`S3_CORS_ALLOW_ORIGIN`. По умолчанию разрешены `http://localhost:3000`,
`http://localhost:3001` и оба соответствующих адреса с `127.0.0.1`.
MinIO обрабатывает preflight для PUT, разрешает `Content-Type`/`x-amz-*` и
раскрывает `ETag`. При смене адреса UI добавьте полный origin в список через запятую
и повторите запуск инфраструктуры, чтобы пересоздать MinIO с новым окружением.

## Профиль изображений

```sh
pnpm infra:dev:images
pnpm backend:prisma:generate
pnpm backend:prisma:deploy
pnpm backend:dev
```

`backend:dev` запускает оба API и worker. Для отдельного запуска только worker:

```sh
pnpm backend:dev:worker
```

`infra:dev:images` поднимает PostgreSQL, MinIO, `minio-init`, RabbitMQ и imgproxy.
Команда ждёт healthchecks долгоживущих сервисов; imgproxy запускается после
успешного завершения `minio-init`. Повторный запуск инициализации безопасен.

### Адреса host и Docker network

| Назначение | Значение для backend/воркера на host |
| --- | --- |
| Браузерный upload и S3-операции воркера | `S3_ENDPOINT=http://localhost:9000` |
| Подпись URL original для скачивания **из imgproxy** | `S3_INTERNAL_ENDPOINT=http://minio:9000` |
| Регион и bucket | `S3_REGION=us-east-1`, `S3_BUCKET=default-bucket` |
| S3 dev-учётные данные | `S3_ACCESS_KEY=user`, `S3_SECRET_KEY=password` |
| Очередь | `RABBITMQ_URL=amqp://image:image-password@localhost:5672/images` |
| Обработчик | `IMGPROXY_URL=http://localhost:18080` |

Воркер на host подписывает внутренний GET URL сразу для `http://minio:9000`,
передаёт его в подписанный запрос imgproxy и сохраняет результат через внешний
`S3_ENDPOINT`. Имя `minio` разрешается в Docker network; host не должен обращаться
по нему самостоятельно. Менять host уже подписанного S3 URL нельзя.
imgproxy принимает source только с префиксом `http://minio:9000/<S3_BUCKET>/`.
Браузер получает ссылки на сохранённые результаты через backend; imgproxy URL
использует воркер для фоновой подготовки изображений.

RabbitMQ: AMQP `localhost:5672`, management <http://localhost:15672>, dev-вход
`image` / `image-password`, vhost `images`. В `infra/dev/.env` это
`RABBITMQ_PORT`, `RABBITMQ_MANAGEMENT_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`
и `RABBITMQ_VHOST`. Пользователь и vhost создаются при первом запуске с пустым
volume. При существующих данных новые credentials следует согласовать с RabbitMQ.
Фиксированный hostname `rabbitmq` сохраняет имя узла при пересоздании контейнера.

### Версии и ограничения ресурсов

- RabbitMQ закреплён как `4.3.6-management-alpine` с digest
  `sha256:3ef7f7e89fed709a78f79b8b5f4e30e1312a1d4089da752e23595566d9d61a95`.
  Лимиты: 1 CPU, 768 MiB RAM, 256 процессов.
- imgproxy закреплён digest
  `sha256:10e03149338f22e27c561b598f12da90109492a401d9afe5811a000cacdbe5c8`.
  Лимиты: 2 CPU, 1 GiB RAM, 256 процессов; `IMGPROXY_WORKERS=2`, очередь внутри
  imgproxy — 8 запросов. `IMGPROXY_MAX_SRC_RESOLUTION=40` согласован с ограничением
  backend в 40 мегапикселей; скачивание ограничено 30 секундами.
- Подпись imgproxy включена: dev-default `IMGPROXY_KEY` — 64 символа `1`,
  `IMGPROXY_SALT` — 64 символа `2` (32-байтовые hex-значения). Эти значения должны
  совпадать в `infra/dev/.env` и `apps/nest-backend/.env`.
- `IMGPROXY_STRIP_METADATA=true` и `IMGPROXY_AUTO_ROTATE=true`: ориентация
  учитывается при подготовке результата, метаданные удаляются.
  `IMGPROXY_PNG_QUANTIZE=false` отключает намеренное уменьшение палитры;
  это не обещание побитовой идентичности результата преобразования.
  Политика «визуально без ухудшения» задаётся обработчиком backend в запросе:
  high-quality AVIF/JPEG и PNG для изображений с alpha. Original хранится без изменений.
- `IMGPROXY_ENABLE_DEBUG_HEADERS=true` позволяет worker сверить фактическую
  геометрию AVIF по `X-Result-Width/Height`, не принимая размер внутреннего tile
  контейнера за размер готового изображения.

Диагностика:

```sh
docker compose -f infra/dev/docker-compose.yml --profile images ps -a
docker compose -f infra/dev/docker-compose.yml --profile images logs --follow rabbitmq imgproxy minio-init
```

## Изолированная проверка

Для отдельного экземпляра задайте другое имя Compose-проекта через `-p` и свободный
набор портов. Команда ниже использует dev-пример, создаёт отдельные volumes и
проверяет healthchecks:

```sh
POSTGRES_PORT=5545 S3_PORT=19000 S3_CONSOLE_PORT=19001 \
RABBITMQ_PORT=15673 RABBITMQ_MANAGEMENT_PORT=15674 IMGPROXY_PORT=18081 \
docker compose -p image-pipeline-check --env-file infra/dev/.env.example \
  -f infra/dev/docker-compose.yml --profile images up -d --wait
```

Для уже собранного MinIO можно добавить к `up` флаг `--no-build`.
При подключении host-воркера к проверочному окружению задайте `POSTGRES_PORT=5545`,
`S3_ENDPOINT=http://localhost:19000`,
`RABBITMQ_URL=amqp://image:image-password@localhost:15673/images` и
`IMGPROXY_URL=http://localhost:18081`; `S3_INTERNAL_ENDPOINT` остаётся
`http://minio:9000`.

Проверка конфигурации и env без вывода значений:

```sh
docker compose -f infra/dev/docker-compose.yml config --quiet
docker compose -f infra/dev/docker-compose.yml --profile storage config --quiet
docker compose -f infra/dev/docker-compose.yml --profile images config --quiet
pnpm env:check
```

Остановка проверочного экземпляра с сохранением данных:

```sh
docker compose -p image-pipeline-check --env-file infra/dev/.env.example \
  -f infra/dev/docker-compose.yml --profile images down
```
