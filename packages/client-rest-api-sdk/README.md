# @demo/client-rest-api-sdk

Приватный workspace SDK для клиентского REST API. Источник контракта —
[`apps/nest-backend/openapi/client.openapi.json`](../../apps/nest-backend/openapi/client.openapi.json).
Генератор зафиксирован: `@gromlab/rest-api-codegen@5.2.4`.
Имя `@demo/client-rest-api-sdk` сохранено для существующих потребителей.

SDK не зависит от React и не создаёт настроенный singleton. URL, credentials,
авторизация, refresh/retry policy и состояние приложения принадлежат потребителю.
Пакет собирается в ESM JavaScript и декларации `dist` с `module` и
`moduleResolution: NodeNext`; относительные импорты TypeScript используют `.js`.
Общая конфигурация — `@repo/typescript-config/base.json`.

## Текущий контракт

SDK перегенерирован из очищенного контракта аккаунтов и браузерных сессий:
**8 операций**, группы `auth` и `users`. В таблице последний столбец — суффикс
прямого импорта `@demo/client-rest-api-sdk/operations/<суффикс>`.

| Метод полного клиента            | HTTP                     | Тело                          | Результат        | Суффикс импорта               |
| -------------------------------- | ------------------------ | ----------------------------- | ---------------- | ----------------------------- |
| `auth.clientAuthRegister`        | `POST /auth/register`    | `RegisterClientUserDto`       | `ClientUserDto`  | `client-auth-register`        |
| `auth.clientBrowserLogin`        | `POST /auth/login`       | `LoginDto`                    | `AccessTokenDto` | `client-browser-login`        |
| `auth.clientBrowserRefresh`      | `POST /auth/refresh`     | —                             | `AccessTokenDto` | `client-browser-refresh`      |
| `auth.clientBrowserLogout`       | `POST /auth/logout`      | —                             | `void` (204)     | `client-browser-logout`       |
| `users.getClientUserProfile`     | `GET /users/me`          | —                             | `ClientUserDto`  | `get-client-user-profile`     |
| `users.updateClientUserProfile`  | `PATCH /users/me`        | `UpdateClientUserProfileDto`  | `ClientUserDto`  | `update-client-user-profile`  |
| `users.changeClientUserLogin`    | `PUT /users/me/login`    | `ChangeClientUserLoginDto`    | `void` (204)     | `change-client-user-login`    |
| `users.changeClientUserPassword` | `PUT /users/me/password` | `ChangeClientUserPasswordDto` | `void` (204)     | `change-client-user-password` |

Операции также доступны по имени из root и `/operations`. Прямая функция принимает
`ApiRequestClient` первым аргументом, тело при его наличии — вторым, `RequestParams`
последним; `createApiClient` связывает первый аргумент с транспортом.
Успешная смена логина/пароля отзывает все сессии; после неё нужен новый вход.

### DTO и вспомогательные типы

Все перечисленные типы доступны из root и `/data-contracts`:

- `RegisterClientUserDto`: `login`, `password`, необязательное `name`.
- `ClientUserDto`: `id`, `login`, `name`, `isActive`, `createdAt`, `updatedAt`.
- `LoginDto`: `login`, `password`.
- `AccessTokenDto`: `accessToken`, `tokenType`, `expiresIn`, `sessionExpiresAt`.
- `UpdateClientUserProfileDto`: необязательное `name`.
- `ChangeClientUserLoginDto`: `currentPassword`, `login`.
- `ChangeClientUserPasswordDto`: `currentPassword`, `newPassword`.
- `ApiErrorDto`: `statusCode: number`, `code: string`, `message: string | string[]`.
- `AccessTokenDtoTokenTypeEnum = "Bearer"`.
- `ClientBrowserLoginParamsXCsrfProtectionEnum = "1"`.
- `ClientBrowserRefreshParamsXCsrfProtectionEnum = "1"`.
- `ClientBrowserLogoutParamsXCsrfProtectionEnum = "1"`.

Даты остаются строками ISO; `expiresIn` — интервал JWT `exp − iat` в целых секундах.
Точный срок сессии задаёт `sessionExpiresAt` и проверяет сервер. Header enum не означает
автоматической настройки заголовков: браузер передаёт `Origin`, а потребитель задаёт
`X-CSRF-Protection: 1` и `credentials: 'include'`. Refresh token передаётся cookie,
не полем DTO. Нет мобильных, AI/SSE или прежних продуктовых операций и DTO.

### Граница совместимости

Ручные AI/SSE overrides, `/streaming` и прежние generated AI-операции удалены.
В `apps/next-web-app/src/infra/client-api` браузерный клиент подключает актуальные
группы `auth/users`, а публичный серверный клиент сохраняет пустое дерево операций.
Транспорт, session, config и helpers сохранены. При изменении контракта обновляйте
API-связи вместе с потребителем, сохраняя инфраструктурных владельцев.
Стандартные exports и имя SDK сохранены. Удалённые операции/DTO не подменяются
`any` или заглушками; product/AI/streaming API в SDK не восстанавливаются.

## Генерация и сборка

После готовности backend и синхронизации workspace-зависимостей назначенный
исполнитель выполняет из корня репозитория:

```sh
# Workspace-зависимости синхронизирует оркестратор, не эти команды.
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false

# 1. Обновить обе схемы из готовых DTO/контроллеров backend.
pnpm --dir apps/nest-backend run openapi:generate

# 2. Проверить содержимое схем; затем сгенерировать оба SDK.
pnpm --filter @demo/client-rest-api-sdk run generate
pnpm --filter @demo/admin-rest-api-sdk run generate

# 3. Проверить и собрать SDK до проверки приложений-потребителей.
pnpm --filter @demo/client-rest-api-sdk run check-types
pnpm --filter @demo/admin-rest-api-sdk run check-types
pnpm --filter @demo/client-rest-api-sdk run build
pnpm --filter @demo/admin-rest-api-sdk run build
```

Команда `generate` читает уже существующий локальный JSON; она не экспортирует
OpenAPI сама. Не используйте старую схему как временную замену готового контракта.
Версия CLI 5.2.4 заменяет **весь** `src/generated`, удаляя устаревшие операции;
при ошибке генерации прежний output сохраняется. Предварительный `rm src` не нужен
и запрещён: ручные `src/http-client.ts` и `src/create-api-client.ts` должны остаться.
После успешной генерации скрипт очищает `dist`, чтобы не оставлять старые compiled
операции доступными через wildcard exports. До следующего `build` пакет не готов
к импорту. `build` также сначала очищает `dist` и не запускает codegen или API.
`typecheck` — совместимый alias `check-types`; тестовая инфраструктура не требуется.

Перед повторной генерацией проверьте актуальные группы, имена, параметры операций
и отсутствие удалённых endpoint в схемах. После неё проверьте exports, отсутствие
старых файлов в `src/generated`/`dist`, выполните повторную генерацию и сборку
для проверки воспроизводимости. Не добавляйте заглушки старых операций ради сборки
ещё не мигрированных consumers. В workspace поддерживаются только два SDK,
соответствующие клиентскому и административному API.

Установка workspace-зависимостей и обновление root lockfile принадлежат оркестратору.
Для проверок нужна доступная ссылка на `@repo/typescript-config`. Чтобы pnpm 11
не запускал автоматическую установку перед `run`/`exec`, используйте
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`, как в примере выше. Этот флаг не заменяет
установку отсутствующих зависимостей и не отключает загрузку CLI через `pnpm dlx`:
генерация остаётся отдельным согласованным этапом.

## Владение исходниками и exports

- `src/generated/**` полностью принадлежит CLI; ручные правки запрещены.
- `src/http-client.ts` и `src/create-api-client.ts` — ручные точки входа вне output.
- Root, `/data-contracts`, `/operations`, `/operations/*`, `/operations-tree`
  направлены на `dist/generated` без overrides.
- `/http-client` и `/create-api-client` направлены на ручные фасады в `dist`.
- Экспортируется только compiled `dist`, не raw TypeScript.

У `/http-client` сохранён общий разбор JSON-ошибок для операций без формата ответа,
включая операции с успешным HTTP 204; SSE-ветки больше нет. `HttpClient` из root —
исходная реализация генератора, без этой дополнительной политики. Для сохранения
прежнего REST-поведения импортируйте транспорт из `/http-client`. `ApiError`
у обеих точек входа принадлежит одной реализации generated этого SDK.

Для полного API используйте `createApiClient(httpClient, operationsTree)`;
для частичного импортируйте нужные `/operations/<operation-name>`, проверив
фактические имена после генерации. Настройки пользовательского транспорта
остаются в приложении; SDK не читает cookies, localStorage или переменные окружения.
Не повторяйте изменяющие запросы без подтверждённой идемпотентности.
