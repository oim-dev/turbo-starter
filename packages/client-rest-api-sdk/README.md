# @oim/client-rest-api-sdk

Приватный workspace SDK для клиентского REST API. Источник контракта —
[`apps/nest-backend/openapi/client.openapi.json`](../../apps/nest-backend/openapi/client.openapi.json).
Генератор зафиксирован: `@gromlab/rest-api-codegen@5.2.4`.
Пакет `@oim/client-rest-api-sdk` использует `apps/next-web-app`.

SDK не зависит от React и не создаёт настроенный singleton. URL, credentials,
авторизация, обработка ошибок и состояние приложения принадлежат потребителю.
Пакет собирается в ESM JavaScript и декларации `dist` с `module` и
`moduleResolution: NodeNext`; относительные импорты TypeScript используют `.js`.
Общая конфигурация — `@oim/typescript-config/base.json`.

## Текущий контракт

SDK содержит аккаунты, браузерные сессии и собственные изображения пользователя:
группы `auth`, `users` и `images`. В таблице аккаунтов последний столбец — суффикс
прямого импорта `@oim/client-rest-api-sdk/operations/<суффикс>`.

| Метод полного клиента            | HTTP                     | Тело                          | Результат        | Суффикс импорта               |
| -------------------------------- | ------------------------ | ----------------------------- | ---------------- | ----------------------------- |
| `auth.clientAuthRegister`        | `POST /auth/register`    | `RegisterClientUserDto`       | `ClientUserDto`  | `client-auth-register`        |
| `auth.clientBrowserLogin`        | `POST /auth/login`       | `LoginDto`                    | `AccessTokenDto` | `client-browser-login`        |
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
- `ClientBrowserLogoutParamsXCsrfProtectionEnum = "1"`.

Даты остаются строками ISO; `expiresIn` — интервал JWT `exp − iat`: **604800 секунд (7 дней)**.
Срок сессии задаёт `sessionExpiresAt` и проверяет сервер. Для входа и выхода браузер передаёт
`Origin`, а потребитель задаёт `X-CSRF-Protection: 1`. Защищённые операции и logout
используют `Authorization: Bearer <accessToken>`. Refresh endpoint и auth cookies
отсутствуют; после истечения JWT нужен новый вход. CORS разрешает любой origin.
Отдельных мобильных и AI/SSE endpoint нет; клиентский API изображений подходит
веб- и мобильным приложениям с клиентским Bearer JWT.

### Граница совместимости

Ручные AI/SSE overrides, `/streaming` и прежние generated AI-операции удалены.
В `apps/next-web-app/src/infra/client-api` браузерный клиент подключает актуальные
группы `auth/users`, а публичный серверный клиент сохраняет пустое дерево операций.
Транспорт, session, config и helpers сохранены. При изменении контракта обновляйте
API-связи вместе с потребителем, сохраняя инфраструктурных владельцев.
Стандартные exports SDK сохранены. Удалённые операции/DTO не подменяются
`any` или заглушками. Новый контракт изображений добавлен отдельной группой;
старые product/AI/streaming API не восстанавливаются.

## Изображения

Группа `images` позволяет создавать загрузки, подтверждать MinIO PUT, читать
статусы и готовые варианты, изменять классификацию и повторять неудавшуюся
обработку. Пользователь видит только свои изображения; общепроектный список
принадлежит Admin API и другому SDK.

`ImageDto.id` остаётся внутренним UUID. `publicId` — отдельные 8 символов base62
с учётом регистра, не усечённый хеш. `original.sha256: string | null` содержит серверно проверенный
SHA-256 оригинала; у старых оригиналов до backfill и ещё не проверенных загрузок
хеш может отсутствовать.

Порядок загрузки:

1. Браузер вычисляет SHA-256 исходных байтов и передаёт его в
   `POST /images/uploads`. В `CreateImageUploadDto` поле `sha256?: string`
   необязательно для совместимости контракта, но браузер всегда его заполняет.
2. `ImageUploadDto` содержит `image`, `reused: boolean`, `upload: ImageUploadTargetDto | null`.
   При `reused: true` `upload` равен `null`: потребитель использует `image`
   и пропускает PUT и complete.
3. При `reused: false` выполняются подписанный MinIO PUT по выданному URL без
   клиентского JWT и `POST /images/:id/complete`.
4. Complete проверяет SHA-256 на сервере; несовпадение даёт `IMAGE_HASH_MISMATCH`.
   Ответ — плоский `ImageCompleteDto`: все поля `ImageDto` и `reused: boolean`,
   без обёртки `image`. При гонке возвращённый `id` может отличаться от загрузочного:
   потребитель принимает каноническую запись из ответа.

Дедупликация ограничена владельцем в Client API: чужие клиентские и административные
загрузки не переиспользуются. Повторы complete и конкурирующие загрузки одного
владельца возвращают одну каноническую запись с одним заданием обработки.
Переиспользование не перезаписывает её метаданные и не обходит проверки доступа.

`search` в списке принимает имя, заголовок, теги, полный UUID, `publicId` и media URL
с извлечением ID; результат ограничен своими изображениями. Готовый URL имеет вид
`/media/images/:publicId/:format/:widthxheight`: размеры фактические, разделитель —
латинская `x`. Прежние `/media/images/:id/:variantId` с UUID продолжают работать.
GET-запросы не создают варианты и не выполняют преобразования: `processing`
отображается как заглушка, а `ready` содержит готовые URL, форматы, реальные размеры
и вес. `srcset` строится по этому списку, `sizes` задаёт потребитель исходя из своей
вёрстки.

Обработка не требует выбора пресетов: сохраняются исходные пропорции, размеры
идут с шагом 200 px. Конечная ширина включается; при остатке меньше 100 px она
заменяет предыдущую ступень. `presets`/`preset` отсутствуют в публичных DTO.

Эти авторизационно-зависимые операции Next.js вызывает только в браузере после
восстановления сессии. Их DTO не передаются через SSR/RSC. Готовое изображение
может участвовать в публичной странице, когда соответствующие данные независимо
от авторизации предоставляет публичный предметный API.

Для существующих данных нужны новая миграция и явный возобновляемый backfill хешей
оригиналов. Контракт и сведения о backfill — в Relay:
`DOC-8` «Изображения: медиатека и фоновая обработка».

## Генерация и сборка

После готовности backend и синхронизации workspace-зависимостей назначенный
исполнитель выполняет из корня репозитория:

```sh
# 1. Обновить обе схемы из готовых DTO/контроллеров backend.
pnpm --dir apps/nest-backend run openapi:generate

# 2. Проверить содержимое схем; затем сгенерировать оба SDK.
pnpm --filter @oim/client-rest-api-sdk run generate
pnpm --filter @oim/admin-rest-api-sdk run generate

# 3. Проверить и собрать SDK до проверки приложений-потребителей.
pnpm --filter @oim/client-rest-api-sdk run check-types
pnpm --filter @oim/admin-rest-api-sdk run check-types
pnpm --filter @oim/client-rest-api-sdk run build
pnpm --filter @oim/admin-rest-api-sdk run build
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
Для проверок нужна доступная ссылка на `@oim/typescript-config`.
Генерация через `pnpm dlx` остаётся отдельным согласованным этапом.

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
