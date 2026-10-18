# @oim/admin-rest-api-sdk

Приватный workspace SDK для административного REST API. Источник контракта —
[`apps/nest-backend/openapi/admin.openapi.json`](../../apps/nest-backend/openapi/admin.openapi.json).
Генератор зафиксирован: `@gromlab/rest-api-codegen@5.2.4`.
Пакет `@oim/admin-rest-api-sdk` использует `apps/react-admin-panel`.

SDK независим от клиентского пакета и React. Он не создаёт singleton и не хранит
URL окружения, токены или cookies. Настройки транспорта и сессии принадлежат
приложению-потребителю. Пакет экспортирует ESM JavaScript и декларации из `dist`,
а не исходный TypeScript. Компиляция — `NodeNext` с `.js` в относительных импортах,
общая конфигурация — `@oim/typescript-config/base.json`.

## Текущий контракт

SDK содержит группы `auth`, `access`, `settings` и `images`: вход и профиль, управление
аккаунтами/ролями/правами, настройки Keycloak и общепроектную галерею. Основные операции авторизации
перечислены ниже; последний столбец — суффикс прямого импорта
`@oim/admin-rest-api-sdk/operations/<суффикс>`.

| Метод полного клиента          | HTTP                 | Тело                     | Результат        | Суффикс импорта              |
| ------------------------------ | -------------------- | ------------------------ | ---------------- | ---------------------------- |
| `auth.adminBrowserLogin`       | `POST /auth/login`   | `LoginDto`               | `AccessTokenDto` | `admin-browser-login`        |
| `auth.adminBrowserLogout`      | `POST /auth/logout`  | —                        | `void` (204)     | `admin-browser-logout`       |
| `auth.adminAuthMe`             | `GET /auth/me`       | —                        | `AdminUserDto`   | `admin-auth-me`              |
| `auth.adminAuthChangePassword` | `PUT /auth/password` | `ChangeAdminPasswordDto` | `void` (204)     | `admin-auth-change-password` |

Операции также доступны по имени из root и `/operations`. Прямая функция принимает
`ApiRequestClient` первым аргументом, тело при его наличии — вторым, `RequestParams`
последним; `createApiClient` связывает первый аргумент с транспортом.
Смена пароля отзывает все сессии администратора; после неё нужен новый вход.

Для управления другими пользователями OWNER использует `access.adminAccountUpdate`:
`UpdateAdminAccountDto` принимает `role`, `isActive`, `version` и необязательные `name`, `login`.
`access.adminAccountPasswordSet({ id }, { password, version })` устанавливает локальный пароль
через `PUT /access/users/:id/password` и возвращает 204 без credentials. Обе операции отзывают
прежние сессии изменяемого аккаунта. DTO и операция сгенерированы из backend OpenAPI.

### DTO и вспомогательные типы

Все перечисленные типы доступны из root и `/data-contracts`:

- `LoginDto`: `login`, `password`.
- `AccessTokenDto`: `accessToken`, `tokenType`, `expiresIn`, `sessionExpiresAt`.
- `AdminUserDto`: профиль, роль и эффективные права администратора; точная структура — в generated-контракте.
- `ApiErrorDto`: `statusCode: number`, `code: string`, `message: string | string[]`.
- `ChangeAdminPasswordDto`: `currentPassword`, `newPassword`.
- `AccessTokenDtoTokenTypeEnum = "Bearer"`.
- `AdminBrowserLoginParamsXCsrfProtectionEnum = "1"`.
- `AdminBrowserLogoutParamsXCsrfProtectionEnum = "1"`.

Даты остаются строками ISO; `expiresIn` — интервал JWT `exp − iat`: **604800 секунд (7 дней)**
для локального входа и Keycloak. Срок сессии задаёт `sessionExpiresAt` и проверяет сервер.
Для browser login/logout и Keycloak complete браузер передаёт `Origin`, потребитель задаёт
`X-CSRF-Protection: 1`. Защищённые операции и logout используют Bearer JWT.
Refresh endpoint и auth cookies отсутствуют; после истечения JWT нужен новый вход.
`credentials: 'include'` требуется только для временных OIDC cookies Keycloak.
CORS разрешает любой origin. Клиентских DTO и прежних продуктовых операций здесь нет.

### Граница совместимости

`apps/react-admin-panel/src/infra/backend-admin-api` использует полное
`operationsTree` и актуальные DTO этого SDK. Устаревшие продуктовые type reexports
удалены; транспорт, session, config и helpers сохранены. При изменении контракта
обновляйте его API-связи вместе с потребителем, сохраняя инфраструктурных владельцев.
Удалённые группы и DTO не подменяются `any` или заглушками.

## Изображения

Административный API предоставляет список всех изображений проекта, поиск и
фильтры, папки/теги, создание загрузки, подтверждение, метаданные и повтор ошибки
обработки. Доступ контролируют `images.read`, `images.upload`, `images.update`.

Создание не принимает пресеты: сервер автоматически сохраняет пропорции и
создаёт сетку ширины 200 px с обработкой короткого остатка. `ImageDto` и
`ImageVariantDto` не содержат `presets`/`preset`; варианты группируются по формату.

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
3. При `reused: false` выполняются бинарный PUT по выданному MinIO URL и
   `POST /images/:id/complete`. JWT административного API не передаётся в MinIO;
   прогресс и отмена PUT принадлежат браузерному транспорту.
4. Complete проверяет SHA-256 на сервере; несовпадение даёт `IMAGE_HASH_MISMATCH`.
   Ответ — плоский `ImageCompleteDto`: все поля `ImageDto` и `reused: boolean`,
   без обёртки `image`. При гонке возвращённый `id` может отличаться от загрузочного:
   потребитель принимает каноническую запись из ответа.

Дедупликация общая для всех загрузок администраторов; видимые в Admin API клиентские
загрузки остаются в области своего владельца. Повторы complete и конкурирующие
загрузки возвращают одну каноническую запись с одним заданием обработки.
Переиспользование не перезаписывает её метаданные и не обходит permissions.

`search` в списке принимает имя, заголовок, теги, полный UUID, `publicId` и media URL
с извлечением ID. Готовый URL имеет вид
`/media/images/:publicId/:format/:widthxheight`: размеры фактические, разделитель —
латинская `x`. Прежние `/media/images/:id/:variantId` с UUID продолжают работать.

API возвращает состояние обработки. Пока оно не `ready`, приложение показывает
заглушку; после готовности использует список фактических размеров и URL. Чтение
изображения не запускает конвертацию. Готовые URL неизменяемы; запросы метаданных
и статуса не должны попадать в долгоживущий публичный кеш.

Для существующих данных нужны новая миграция и явный возобновляемый backfill хешей
оригиналов. Порядок и команды — в
[документации backend](../../apps/nest-backend/docs/images.md), включая сценарии приёмки.
Обзор сквозного контракта — в Relay: `DOC-8` «Изображения: медиатека и фоновая обработка».

## Генерация и сборка

Точный общий порядок для двух API описан в
[`client-rest-api-sdk/README.md`](../client-rest-api-sdk/README.md#генерация-и-сборка).
После экспорта обеих актуальных схем из `apps/nest-backend` команды этого SDK
из корня репозитория:

```sh
pnpm --filter @oim/admin-rest-api-sdk run generate
pnpm --filter @oim/admin-rest-api-sdk run check-types
pnpm --filter @oim/admin-rest-api-sdk run build
```

`generate` читает локальный JSON. CLI 5.2.4 заменяет весь `src/generated`, поэтому
устаревшие operations не накапливаются. При ошибке генерации прежний output
сохраняется. После успешной генерации очищается `dist`, исключая старые compiled
операции из wildcard exports; пакет снова доступен для импорта после `build`.
Ручные `src/http-client.ts` и `src/create-api-client.ts` находятся вне output
и сохраняются. Не удаляйте весь `src` и не редактируйте generated вручную.

`build` очищает `dist` и компилирует существующие исходники без генерации,
обращений к API или запуска backend. `typecheck` — alias `check-types`.
После финальной генерации проверьте фактические exports, параметры и группы,
отсутствие старых операций и воспроизводимость повторной генерации/сборки.

Workspace-зависимости и root lockfile синхронизирует оркестратор. Для проверок
нужна доступная ссылка на `@oim/typescript-config`. Генерация через `pnpm dlx`
остаётся отдельным согласованным этапом.

## Публичные экспорты

- Root: generated-контракты, операции, `operationsTree` и runtime primitives.
- `/http-client`: ручной фасад `HttpClient`, `ApiError`, `ContentType` и типов.
- `/create-api-client`: ручной фасад `createApiClient` и типов сборки клиента.
- `/data-contracts`: generated DTO.
- `/operations`: generated barrel операций.
- `/operations/<operation-name>`: прямой импорт операции.
- `/operations-tree`: generated-дерево операций.

Для небольшого клиента используйте прямые operation imports вместо полного
дерева. Создавайте `HttpClient` с настройками приложения; SDK не подменяет
клиентскую авторизацию административной и не повторяет запросы автоматически.
Используйте `ApiError` из этого SDK, не из другого пакета. `credentials: 'include'`
в Node.js само по себе не создаёт cookie-хранилище; серверная сессия должна быть
ограничена текущим запросом. Сетевые ограничения административного API находятся
в backend/инфраструктуре и не обеспечиваются именем пакета или CORS.
