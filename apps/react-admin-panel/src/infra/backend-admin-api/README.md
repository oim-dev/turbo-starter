# Административный API-клиент

`infra/backend-admin-api` предоставляет полный технический контракт
`@demo/admin-rest-api-sdk` для браузерного React SPA. Источник операций —
`apps/nest-backend/openapi/admin.openapi.json`, generated-код принадлежит workspace SDK.
Публичные exports и подготовка SDK описаны в
[его README](../../../../../packages/admin-rest-api-sdk/README.md).

## Публичный API

Импортируй клиент и транспортные типы через `infra/backend-admin-api`.

```ts
import { backendAdminApi } from 'infra/backend-admin-api'

const profileDto = await backendAdminApi.auth.adminAuthMe()
```

| Группа | Методы |
| --- | --- |
| `auth` | `adminBrowserLogin`, `adminBrowserRefresh`, `adminBrowserLogout`, `adminAuthMe`, `adminAuthChangePassword` |

Аргументы и DTO сохраняют контракт SDK. Предметную валидацию, преобразование DTO
и интерпретацию ошибок выполняют доменные адаптеры.
Экран смены пароля в базовую SPA не входит; наличие операции в полном клиенте не добавляет UI.

## Транспорт и авторизация

Один настроенный `HttpClient` использует `/api`, браузерные cookies,
`X-CSRF-Protection: 1`, тайм-аут 10 секунд и `cache: 'no-store'`.
Адрес сервера задаётся прокси приложения. Браузер самостоятельно управляет
`Origin` и HttpOnly refresh cookie.

Access token хранится только в памяти текущего JavaScript runtime:

- `getBackendAdminApiAccessToken()` возвращает текущий токен или `null`;
- `setBackendAdminApiAccessToken(token)` устанавливает непустую непрозрачную строку без пробельных символов;
- `clearBackendAdminApiAccessToken()` удаляет токен.

Владелец авторизации явно устанавливает проверенный токен после login/refresh и
очищает его при завершении сессии. Сам HTTP-вызов возвращает DTO или техническую
ошибку. Перед каждым Bearer-запросом транспорт читает актуальный токен; явно
заданный `Authorization` имеет приоритет.

Login, refresh и logout используют собственный wire contract без автоматически
добавленного Bearer. Пути этих операций перечислены в `helpers/authorize-request.ts`,
поскольку generated `secure: true` объединяет разные схемы OpenAPI.

Refresh выполняется явным вызовом `backendAdminApi.auth.adminBrowserRefresh()`.
Автоматические refresh и retry отключены: сервер использует одноразовую ротацию
refresh token. Координация обменов и жизненный цикл сессии принадлежат вызывающему
владельцу авторизации.

## Ошибки

`isBackendAdminApiError(error)` сужает `unknown` до `ApiError<unknown>` из SDK.
Статус, ответ и запрос доступны в исходном техническом контракте. Сетевые ошибки
и ошибки разбора успешного ответа сохраняются как исходные исключения.

`getBackendAdminApiErrorAccessToken(error)` извлекает Bearer из фактически
отклонённого запроса. Доменный адаптер использует его для сравнения с текущим
credential перед обработкой terminal `401`; поздний ответ старого запроса сам
по себе не изменяет текущий токен.

## Проверка

Из корня репозитория:

```sh
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
pnpm --filter @demo/admin-rest-api-sdk run build
pnpm --dir apps/react-admin-panel run lint
pnpm --dir apps/react-admin-panel run check-types
pnpm --dir apps/react-admin-panel run build
```
