# Nest Backend

Базовый backend на NestJS 11, Prisma 7 и PostgreSQL 16. Два самостоятельных
HTTP-приложения обслуживают клиентские и административные аккаунты.

| Приложение | API                     | Swagger | Спецификация    |
| ---------- | ----------------------- | ------- | --------------- |
| Client API | `http://localhost:3001` | `/docs` | `/openapi.json` |
| Admin API  | `http://localhost:3002` | `/docs` | `/openapi.json` |

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
дополнительные аккаунты создаёт OWNER через `/access/users` в интерфейсе админки.
После смены собственного пароля все административные сессии аккаунта отзываются.

### Роли и permissions

Роли относятся только к аккаунтам админки. Client API остаётся независимым.
`OWNER` имеет все права; `ADMIN` — все несистемные права из каталога; `USER` — просмотр
и изменение своего профиля, логина и пароля. Сейчас предметных операций сверх аккаунта нет,
поэтому ADMIN и USER имеют одинаковые несистемные возможности. Новые прикладные permissions
автоматически доступны ADMIN, но не USER.

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
| PATCH | `/access/users/:id` | Назначение роли и изменение активности |
| POST | `/access/users/:id/identities` | Привязка пользователя Keycloak по issuer/sub |
| DELETE | `/access/users/:id/identities/:identityId` | Отзыв привязки Keycloak |
| DELETE | `/access/users/:id/local-password` | Отключение локального пароля |
| DELETE | `/access/users/:id/sessions` | Отзыв всех сессий аккаунта |
| GET / PUT | `/settings/keycloak` | Чтение безопасных настроек / сохранение конфигурации |

### Keycloak + локальный пароль (только Admin API)

Подробная настройка, provisioning и ограничения: [docs/admin-keycloak.md](docs/admin-keycloak.md).
Сценарии приёмки: [docs/admin-keycloak-qa.md](docs/admin-keycloak-qa.md).

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/auth/providers` | `{ local: true, keycloak: boolean }`, public, no-store; флаг конфигурации, не health-check |
| GET | `/auth/keycloak/login?returnTo=/profile` | Навигация на OIDC Authorization Code + PKCE S256 |
| GET | `/auth/keycloak/callback` | Callback, проверка identity, выдача только временного completion grant |
| POST | `/auth/keycloak/complete` | Без тела; Origin + X-CSRF-Protection: 1 и временные HttpOnly cookies; тот же AccessTokenDto с Bearer JWT, что у local login |

В `/auth/me` добавлено `hasLocalPassword`. Для SSO-only аккаунта локальный вход
запрещён, а смена пароля возвращает `403 LOCAL_PASSWORD_UNAVAILABLE`. Локальный вход
других администраторов работает независимо от доступности Keycloak. Client API,
его аккаунты и SDK не участвуют в этой интеграции. Нет JIT/email-link или автоматической
выдачи OWNER: identity `(issuer, subject)` заранее связывает доверенный оператор.
Logout только локальный. Контракт JWT/сессии приложения — 7 дней без продления;
back-channel/global SSO logout и мгновенная синхронизация блокировок KC не реализованы.
Живая SSO-сессия Keycloak может выполнить новый вход без ввода пароля.

Keycloak по умолчанию выключен. OWNER вводит issuer, client ID, secret и callbacks
в интерфейсе `/settings/keycloak`. Все настройки, включая client secret, хранятся
в БД; env-переменных Keycloak и внешнего ключа шифрования нет.
Secret доступен только для записи и не возвращается API. Смена конфигурации
отзывает собственные SSO-сессии и незавершённые обмены, локальные сессии сохраняются.
Отдельного TTL в настройках Keycloak нет: локальный и OIDC-вход выдают JWT
с одинаковым фиксированным сроком.

## Браузерная авторизация

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

В рабочей схеме остаются клиентские/административные аккаунты, их сессии,
admin identity и короткоживущие OIDC exchanges. Refresh-модели удалены;
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
используются frontend-приложениями через workspace-зависимости. Их предметные контракты очищены.

Для admin-only изменений не генерируйте Client SDK:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --filter @oim/nest-backend openapi:generate
git diff --exit-code -- apps/nest-backend/openapi/client.openapi.json
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --filter @oim/admin-rest-api-sdk generate
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --filter @oim/admin-rest-api-sdk check-types
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --filter @oim/admin-rest-api-sdk build
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
```

Приёмка выполняется ручными HTTP-сценариями: регистрация, вход, JWT на 7 дней,
отсутствие refresh, logout через Bearer, профиль, смена логина/пароля и изоляция двух API.

Служебного CLI у backend нет. Начальная учётная запись создаётся lifecycle-сервисом
при запуске Admin API после миграций. Истёкшие сессии автоматически очищаются при
запуске и раз в минуту, каждым API только в своём контуре; Admin API также очищает
истёкшие OIDC exchanges. Текущие проверки TTL не зависят от фоновой очистки.
Команды Prisma остаются инструментами миграций, а не интерфейсом управления аккаунтами.

## Следующий этап

Изображения, аватары, кроп и очереди будут реализованы отдельным этапом. Текущий
backend не зависит от S3. Локальный MinIO доступен как необязательный профиль
`storage` в [infra/dev](../../infra/dev/README.md).
