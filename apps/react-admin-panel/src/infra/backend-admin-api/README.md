# Административный API-клиент

`infra/backend-admin-api` предоставляет технический контракт `@oim/admin-rest-api-sdk`.
Операции и DTO принадлежат workspace SDK; приложение не редактирует generated-код.
Предметные модели, ошибки и решение о доступе принадлежат доменным адаптерам.

## Транспорт

Единственный `HttpClient` использует `BACKEND_ADMIN_API_BASE_URL` (`/api`),
`credentials: 'include'`, `X-CSRF-Protection: 1`, `cache: 'no-store'` и timeout 10 секунд.
Cookie нужны только одноразовому Keycloak OIDC flow, не login/logout или восстановлению сессии.
Перед каждым защищённым запросом `onRequest` читает актуальный persisted JWT и добавляет Bearer.
Явный Authorization сохраняется: logout использует credential, захваченный до локальной очистки.
Login и Keycloak complete не получают автоматический Bearer. Refresh, retry и replay отсутствуют.

При прямом cross-origin доступе backend должен разрешать preflight `OPTIONS` для
`Authorization`, `Content-Type`, `X-CSRF-Protection` и используемых методов. Для credentialed
запросов нужен отражённый Origin с `Vary: Origin` и `Access-Control-Allow-Credentials: true`,
не wildcard `*`. Открытый CORS не заменяет Bearer-проверку и ограничения OIDC callback.

## Persistence

Ключ: `admin-api-credential:v1:${encodeURIComponent(normalizedBaseUrl)}`.
Base URL разрешается относительно `window.location.origin`, завершающие `/` удаляются.
Для localhost:5173 это scope `http://localhost:5173/api`. Смена target Vite proxy не меняет
публичный API URL: перед переключением proxy на другое окружение нужно выйти или очистить credential.

Единственный ключ хранит два варианта совместимой схемы v1:

- credential: `{ version: 1, id, accessToken: string, expiresAt: number }` — прежние записи читаются без миграции;
- tombstone: `{ version: 1, id, accessToken: null, expiresAt: null }` — credential удалён, поколение сохранено.

`id` — случайное общее поколение записи, не серверный `sid`; `expiresAt` — абсолютный Unix ms,
ограниченный JWT `exp` и сроком ответа login/complete. JWT и поколение меняются одним `setItem`,
без второго mutable ключа. Каждый явный clear, включая logout при отсутствующем JWT, записывает новый `id`.
Чтение корректной записи, bootstrap и уведомления не меняют `id` и не продлевают TTL.
Tombstone не удаляется до следующей записи: отсутствие JWT не означает отсутствие истории завершения.
Профиль, permissions, пароль, client secret и OIDC tokens не сохраняются.

- `getBackendAdminApiCredentialSnapshot()` возвращает `{ revision, credential }` из одной записи.
  Только изначально отсутствующий ключ даёт `revision: null`; tombstone даёт своё поколение и `credential: null`.
- `getBackendAdminApiCredential()` валидирует schema/version, формат JWT, `exp` и абсолютный срок.
  Повреждённый, неподдерживаемый или просроченный credential заменяется tombstone и возвращается `null`.
  Проверка подписи, отзыва и прав остаётся у `/auth/me` и серверных guards.
- `getBackendAdminApiAccessToken()` возвращает JWT из проверенной записи либо `null`.
- `setBackendAdminApiAccessToken(token, sessionExpiresAt)` создаёт новую запись только после входа.
- `clearBackendAdminApiAccessToken()` удаляет JWT, записывая новое поколение tombstone данного API scope.
- `openBackendAdminApiCredentialCoordination(onChange)` использует тот же ключ для Web Lock,
  storage events и value-free BroadcastChannel. Реализация браузерных примитивов — `infra/browser-storage`.
- `revokeBackendAdminApiCredential(token)` вызывает SDK logout с явным захваченным Bearer.

Старый `admin-auth-session-v1` не мигрируется: это маркер cookie-протокола, не credential.
Совместимость сохранённых credential v1 не означает поддержку одновременно работающего старого runtime,
который ещё не понимает tombstone: при обновлении приложения такие вкладки нужно перезагрузить.
Нет fallback в память, Zustand persist или скрытого игнорирования недоступного storage.
LocalStorage доступен любому JavaScript страницы: необходима защита от XSS, credential нельзя логировать.

## Ошибки

Клиент не импортирует домены, stores или SWR и не меняет состояние авторизации.
`isBackendAdminApiError` идентифицирует SDK `ApiError`.
`getBackendAdminApiErrorAccessToken` возвращает Bearer отклонённого запроса:
вызывающий домен сравнивает его с текущим credential перед обработкой terminal `401`.
Старый `401` не удаляет новый вход. Сетевые ошибки не означают отзыв JWT.

## Проверки

После генерации и сборки свежего SDK оркестратором, из корня приложения:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run lint
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run check-types
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run build
```
