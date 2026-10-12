# Nest Backend

Базовый backend на NestJS 11, Prisma 7 и PostgreSQL 16. Два самостоятельных
HTTP-приложения обслуживают клиентские и административные аккаунты, изображения и документы.
Отдельный worker обрабатывает изображения через RabbitMQ, imgproxy и MinIO.

[Файлы и версии](docs/files.md): загрузка в S3, дедупликация SHA-256 и постоянные
ссылки `/files/:publicId/:filename`. Имя документа меняется только при переименовании,
версии сохраняют свои исходные имена. Без параметров открывается текущая версия,
`?version=N` фиксирует редакцию, `?download=1` включает скачивание. Обычный URL —
просмотр inline: PDF и медиа с MIME версии, MD и другие текстовые исходники — текстом.
Файлы любых форматов и размеров: SHA-256 вычисляется потоково, большие объекты
передаются multipart. Публичная выдача идёт через API с Range/HEAD без раскрытия S3.

| Приложение | API                     | Swagger | Спецификация    |
| ---------- | ----------------------- | ------- | --------------- |
| Client API | `http://localhost:4000` | `/docs` | `/openapi.json` |
| Admin API  | `http://localhost:4001` | `/docs` | `/openapi.json` |

Оба API по умолчанию слушают `0.0.0.0`: доступны на всех интерфейсах, локально — через `localhost`.

У каждого API собственные JWT secret, issuer/audience и таблицы сессий.
Access JWT и сессия действуют фиксированные **7 дней (604800 секунд)**, без refresh.
Клиентский токен не даёт доступа к Admin API и наоборот.

## Быстрый запуск

Нужны Node.js 24+, pnpm 11.25.0 и Docker Compose v2+. Команды выполняются из корня
монорепозитория:

```sh
pnpm install
pnpm infra:dev:up
pnpm backend:prisma:generate
pnpm backend:prisma:deploy
pnpm backend:dev
```

При стандартных настройках примеры `.env` копировать не обязательно. Для своих
значений используйте `infra/dev/env.example` и `apps/nest-backend/.env.example`.
Явное окружение и `apps/nest-backend/.env` приоритетнее `infra/dev/.env`.
Подключение задаётся через `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`,
`POSTGRES_PASSWORD` и `POSTGRES_DB`. Для dev по умолчанию: `localhost:5544`,
пользователь `user`, пароль `password`, база `default-db`.
Prisma CLI и оба API собирают строку подключения из этих параметров; `DATABASE_URL`
больше не используется. Настройки backend и загрузка env-файлов не зависят от `NODE_ENV`.
`DOTENV_CONFIG_PATH` задаёт единственный env-файл вместо обоих стандартных.

При запуске Admin API автоматически создаётся владелец **`admin/admin`** только в пустой
таблице административных аккаунтов. Повторный запуск не меняет пароль и не восстанавливает
admin после смены его логина. `BOOTSTRAP_ADMIN_PASSWORD` позволяет переопределить первоначальный пароль.
Обязательной смены пароля и блокировки запуска с admin/admin нет; владелец меняет пароль
в профиле перед production-эксплуатацией.

Отдельный запуск:

```sh
pnpm backend:dev:client
pnpm backend:dev:admin
```

## Аккаунт клиента

| Метод | Путь                 | Действие                                                    |
| ----- | -------------------- | ----------------------------------------------------------- |
| POST  | `/auth/register`     | Создать аккаунт: `login`, `password`, необязательное `name` |
| POST  | `/auth/login`        | Войти по `login` и `password`                               |
| POST  | `/auth/logout`       | По Bearer JWT отозвать текущую сессию                        |
| GET   | `/users/me`          | Получить собственный профиль                                |
| PATCH | `/users/me`          | Изменить `name`                                             |
| PUT   | `/users/me/login`    | Изменить `login`, подтвердив `currentPassword`              |
| PUT   | `/users/me/password` | Передать `currentPassword` и `newPassword`                  |

Профиль содержит `id`, `login`, `name`, `isActive`, `createdAt`, `updatedAt`.
Логин нормализуется в нижний регистр и уникален. После регистрации выполняется
отдельный вход. Пароль клиента — от 8 до 128 символов.

Смена логина или пароля отзывает все сессии пользователя, включая текущую.
Успешный ответ — `204`; клиент удаляет свой JWT, затем необходим новый вход.
Обычное изменение имени сохраняет сессию.

## Аккаунт администратора

| Метод | Путь             | Действие                                          |
| ----- | ---------------- | ------------------------------------------------- |
| POST  | `/auth/login`    | Войти                                             |
| POST  | `/auth/logout`   | По Bearer JWT отозвать текущую сессию               |
| GET   | `/auth/me`       | Получить собственный профиль                      |
| PUT   | `/auth/password` | Изменить пароль: `currentPassword`, `newPassword` |
| PUT   | `/auth/login` | Изменить свой логин и отозвать все сессии |
| PATCH | `/auth/me` | Изменить имя собственного аккаунта |

Публичная регистрация администратора отсутствует. Первый владелец создаётся при запуске;
дополнительные аккаунты создаёт OWNER через `/management/users` в интерфейсе админки.
После смены собственного пароля все административные сессии аккаунта отзываются.

### Роли и permissions

Роли относятся только к аккаунтам админки. Client API остаётся независимым.
`OWNER` имеет все права; `ADMIN` — все несистемные права из каталога; `USER` — просмотр
и изменение своего профиля, логина и пароля. `images.read`, `images.upload`,
`images.update` управляют галереей, загрузкой/повтором и классификацией изображений.
Новые прикладные permissions автоматически доступны ADMIN, но не USER.

Встроенные роли неизменяемы. OWNER создаёт дополнительные роли, выбирая проверяемые
сервером permissions; `account.read` обязателен, системные права не делегируются.
Роли и назначения хранятся в БД, каталог действий определён кодом. Произвольный ключ
не создаёт новую серверную возможность. Подробнее: [docs/admin-access.md](docs/admin-access.md).

| Метод | Путь | Назначение (только OWNER) |
| --- | --- | --- |
| GET | `/access/permissions` | Каталог действий |
| GET / POST | `/access/roles` | Список / создание роли |
| PUT / DELETE | `/access/roles/:key` | Изменение / удаление неназначенной дополнительной роли |
| GET / POST | `/access/users` | Список / создание аккаунта |
| PATCH | `/access/users/:id` | Изменение имени, логина, роли и активности по ожидаемой версии |
| PUT | `/access/users/:id/password` | Установка нового локального пароля по ожидаемой версии |
| POST | `/access/users/:id/identities` | Привязка пользователя Keycloak по issuer/sub |
| DELETE | `/access/users/:id/identities/:identityId` | Отзыв привязки Keycloak |
| DELETE | `/access/users/:id/local-password` | Отключение локального пароля |
| DELETE | `/access/users/:id/sessions` | Отзыв всех сессий аккаунта |

`PATCH /access/users/:id` дополнительно принимает необязательные `name` и `login`:
имя очищается от пробелов по краям, логин переводится в нижний регистр и остаётся уникальным.
`PUT /access/users/:id/password` принимает `password` (12–128 символов) и текущую `version`;
может как заменить пароль, так и включить локальный вход для аккаунта без пароля.
Изменения выполняются в существующей транзакции управления доступом, проверяют OWNER,
записываются в аудит без credentials и отзывают прежние сессии. Версия защищает от
перезаписи конкурентных изменений. Схема БД и дополнительные миграции не требуются.
| GET / PUT | `/settings/keycloak` | Чтение безопасных настроек / сохранение конфигурации |

### Keycloak + локальный пароль (только Admin API)

Подробная настройка, provisioning и ограничения: [docs/admin-keycloak.md](docs/admin-keycloak.md).
Сценарии приёмки: [docs/admin-keycloak-qa.md](docs/admin-keycloak-qa.md).

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/auth/providers` | `{ local: true, keycloak: boolean }`, public, no-store; флаг конфигурации, не health-check |
| GET | `/auth/keycloak/login?returnTo=/profile` | Навигация на OIDC Authorization Code + PKCE S256 |
| GET | `/auth/callback` | Callback, проверка identity, выдача только временного completion grant; `/auth/keycloak/callback` — совместимый прежний путь |
| POST | `/auth/keycloak/complete` | Без тела; Origin + X-CSRF-Protection: 1 и временные HttpOnly cookies; тот же AccessTokenDto с Bearer JWT, что у local login |

В `/auth/me` добавлено `hasLocalPassword`. Для SSO-only аккаунта локальный вход
запрещён, а смена пароля возвращает `403 LOCAL_PASSWORD_UNAVAILABLE`. Локальный вход
других администраторов работает независимо от доступности Keycloak. Client API,
его аккаунты и SDK не участвуют в этой интеграции. Первый проверенный вход новой
identity `(issuer, subject)` создаёт SSO-only аккаунт с ролью USER, именем из profile
и `isActive: false`. Вход в панель разрешает администратор через существующий переключатель
«Разрешить вход». До этого callback возвращает `keycloak_inactive`, JWT/сессия не выдаются.
На новой БД настройки уже содержат issuer `https://route66.biocad.ru/realms/biocad`
и callback URL админки на `http://localhost:3001`: `/api/auth/callback` и
`/auth/keycloak/callback`. Client ID и Client Secret нужно заполнить перед включением входа.
`accounts.read` позволяет просматривать пользователей; `accounts.activate` — разрешать вход
через `POST /access/users/:id/activate` с ожидаемой `version`. Права есть у ADMIN/OWNER
и могут назначаться дополнительным ролям. Роль пользователя эта операция не меняет.
Существующие привязки сохраняют аккаунт и права; отключённые аккаунты и отозванные
identity получают отказ. Email, логин и роли Keycloak не используются для назначения доступа.
Logout только локальный. Контракт JWT/сессии приложения — 7 дней без продления;
back-channel/global SSO logout и мгновенная синхронизация блокировок KC не реализованы.
Живая SSO-сессия Keycloak может выполнить новый вход без ввода пароля.

Keycloak по умолчанию выключен. OWNER вводит issuer, client ID, secret и callbacks
в интерфейсе `/management/keycloak`. Все настройки, включая client secret, хранятся
в БД; env-переменных Keycloak и внешнего ключа шифрования нет.
Secret доступен только для записи и не возвращается API. Смена конфигурации
отзывает собственные SSO-сессии и незавершённые обмены, локальные сессии сохраняются.
Отдельного TTL в настройках Keycloak нет: локальный и OIDC-вход выдают JWT
с одинаковым фиксированным сроком.

## Браузерная авторизация

Частота HTTP-запросов в Client API и Admin API не ограничивается.

Access-токен приходит только в JSON; для защищённых запросов передавайте
`Authorization: Bearer <accessToken>`. Основная авторизация не использует cookies.
Оба API выдают JWT на 7 дней, срок сессии равен сроку JWT и не продлевается запросами.
TTL не настраивается через env. `/auth/refresh` удалён, refresh-токенов нет;
после истечения срока нужен новый вход.

`POST /auth/logout` требует Bearer JWT и отзывает именно текущую сессию на сервере;
клиент также удаляет сохранённый токен. Для браузерных `/auth/login` и `/auth/logout`
обязательны корректный HTTP(S) `Origin` и `X-CSRF-Protection: 1`, без allowlist.
Для передачи самого JWT `credentials: 'include'` не требуется.

Неверный текущий пароль при смене логина или пароля возвращает
`401 CURRENT_PASSWORD_INVALID` и не отзывает сессию. Клиент показывает ошибку
подтверждения и сохраняет JWT; терминальный отказ самого Bearer требует нового входа.

CORS разрешает любой origin и запрашиваемые заголовки: `origin: true`, `credentials: true`.
Сервер отражает Origin, а не сочетает `*` с credentials. Allowlist-переменные удалены,
при смене порта UI CORS перенастраивать не нужно. Это не отменяет проверок JWT и прав.
Оба API доверяют всем прокси (`trust proxy: true`); переменных `*_TRUSTED_PROXIES` нет.

Исключение для cookies — короткоживущие browser-binding/completion cookies Admin OIDC.
Для `/auth/keycloak/complete` по-прежнему нужны `Origin`, `X-CSRF-Protection: 1`
и временные cookies (`credentials: 'include'` при fetch). Они HttpOnly, SameSite=Lax;
Secure и префикс `__Host-` автоматически включаются для HTTPS callback из настроек
Keycloak в БД; для локального HTTP используются обычные имена. Cookie env нет.

## Схема и миграции

Рабочая схема содержит клиентские/административные аккаунты, их сессии,
admin identity, короткоживущие OIDC exchanges, изображения, варианты, задания,
outbox и scoped SHA-256 claims. Изображения сохраняют UUID и получают публичный
8-символьный base62 ID. Дедупликация, читаемые media URL и явный возобновляемый
backfill описаны в [docs/images.md](docs/images.md).
Refresh-модели удалены;
для обновления существующей БД нужна миграция, одного удаления env недостаточно.
Исторические миграции сохранены неизменными; очищающая миграция
удаляет сущности исходного продукта. Она предназначена для перевода копии проекта
к шаблону и удаляет прежние предметные данные.

Перед применением к существующей БД определите, нужны ли её данные. Для проверки
шаблона используйте отдельную БД. Автоматического сброса БД и volumes в командах нет.

`20261007120000_admin_keycloak` меняет только Admin-модели, сохраняет существующие
password hashes и сессии (`identityId = NULL` для local/исторических). Она не мигрирует
пароли в Keycloak и не меняет Client-модели. Сначала применить миграцию, затем выпускать
новый Admin API. Откат старого кода после появления NULL password требует отдельного
плана данных; автоматической down-migration нет.

`20261009120000_admin_permissions_settings` добавляет роли, настройки и аудит.
OWNER сохраняется, SUPPORT становится дополнительной ролью с прежними правами.
Credentials, клиентские данные и локальные сессии сохраняются. Настройки из env
автоматически не переносятся: после миграции OWNER настраивает Keycloak через интерфейс.

`20261009130000_remove_refresh_tokens` удаляет обе таблицы refresh-токенов и
`AdminKeycloakSettings.sessionTtlSeconds`, сохраняя аккаунты и существующие сессии.
Ранее выданные JWT не продлеваются: недельный токен выдаётся при новом входе.

`20261009140000_keycloak_db_only` заменяет зашифрованный secret на поле `clientSecret`
в БД. Прежний Keycloak отключается, незавершённые OIDC flows удаляются, SSO-сессии
отзываются. OWNER повторно вводит secret и включает провайдера через настройки.
Локальные аккаунты и сессии сохраняются.

## OpenAPI и SDK

Источники контрактов — DTO и контроллеры двух API. После их изменения:

```sh
pnpm rest-api-sdk:generate
pnpm rest-api-sdk:check-types
pnpm rest-api-sdk:build
```

Экспорт спецификаций не требует работающей БД. Операции SDK создаются закреплённой
версией `@gromlab/rest-api-codegen`; generated-код вручную не редактируется.
Пакеты `@oim/client-rest-api-sdk` и `@oim/admin-rest-api-sdk`
используются frontend-приложениями через workspace-зависимости; контракты изображений
экспортируются для обоих API.

Для admin-only изменений не генерируйте Client SDK:

```sh
pnpm --filter @oim/nest-backend openapi:generate
git diff --exit-code -- apps/nest-backend/openapi/client.openapi.json
pnpm --filter @oim/admin-rest-api-sdk generate
pnpm --filter @oim/admin-rest-api-sdk check-types
pnpm --filter @oim/admin-rest-api-sdk build
```

В среде проверки задайте `DOTENV_CONFIG_PATH=/dev/null`,
явные независимые JWT secrets и все пять `POSTGRES_*` для изолированной БД.
Генерация не вызывает discovery или БД.
Навигационные endpoints исключены из fetch-SDK; добавлены
`auth.adminAuthProviders()` и `auth.adminKeycloakComplete()` без тела.

## Проверки и сборка

```sh
pnpm backend:lint
pnpm backend:check-types
pnpm backend:build
```

Запуск собранных точек входа:

```sh
pnpm --filter @oim/nest-backend start:client
pnpm --filter @oim/nest-backend start:admin
pnpm --filter @oim/nest-backend start:worker
```

Приёмка выполняется ручными HTTP-сценариями: регистрация, вход, JWT на 7 дней,
отсутствие refresh, logout через Bearer, профиль, смена логина/пароля и изоляция двух API.

Служебного CLI у backend нет. Начальная учётная запись создаётся lifecycle-сервисом
при запуске Admin API после миграций. Истёкшие сессии автоматически очищаются при
запуске и раз в минуту, каждым API только в своём контуре; Admin API также очищает
истёкшие OIDC exchanges. Текущие проверки TTL не зависят от фоновой очистки.
Команды Prisma остаются инструментами миграций, а не интерфейсом управления аккаунтами.

## Изображения

Полный контракт, переменные окружения, политика качества и ручная приёмка:
[docs/images.md](docs/images.md). Инфраструктура — профиль `images` в
[infra/dev](../../infra/dev/README.md).

`POST /images/uploads` выдаёт presigned PUT в staging MinIO; идемпотентный complete
замораживает оригинал и атомарно сохраняет job/outbox. Client API видит только свои
загрузки, Admin API — общую галерею. Worker готовит только пропорциональные варианты
без кадрирования и увеличения: ширины 200, 400, …, максимум min(2000, ширина исходника
после EXIF). Некратный максимум добавляется; при остатке меньше 100 px он заменяет
последнюю сеточную ширину (850 → 200/400/600/850, 900 → 200/400/600/800/900).
Форматы — AVIF q80 и JPEG q92 либо PNG для графики/alpha. Это визуально высокое
качество, не гарантия pixel-lossless; оригинал хранится побайтно. API принимает
`{filename,contentType,byteSize,title?,folder?,tags?}`, варианты выбираются по
`(width,format)`; полей `presets`/`preset` в контракте нет.

Для indexed PNG worker один раз создаёт приватный полноразмерный несжатый TIFF
через imgproxy, чтобы убрать дефект повторной палитровой квантизации/alpha.
Все варианты строятся независимо из этого TIFF; временный объект передаётся
потоком в MinIO и удаляется после попытки. Обычные JPEG/PNG/WebP обрабатываются
непосредственно из оригинала. Подробности лимитов и cleanup — в `docs/images.md`.

Публичный `/media/images/:id/:variantId` выдаёт только ready-варианты без обработки.
Оригинал доступен через защищённый `/images/:id/original` как `{url,expiresAt}`.
API не подключается к broker/imgproxy при запуске; GET не ставит задания в очередь.
Для старых ready-наборов manifest выбирает original-семью либо одну существующую
legacy-семью без смешения геометрии. Все прежние UUID URL и байты сохраняются;
legacy enum/столбцы остаются только переходным слоем хранения. Complete/retry
используют новую пропорциональную обработку независимо от старых настроек.
`dev`/`build`/`start` охватывают оба API и worker, `dev:worker`/`build:worker`/
`start:worker` запускают его отдельно. Prisma migration:
`20261011120000_images_pipeline`; автоматически к существующей БД не применяется.
