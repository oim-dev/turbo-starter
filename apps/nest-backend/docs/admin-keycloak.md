# Административный OIDC-вход

## Конфигурация и Keycloak

Конфигурацией управляет OWNER на странице админки `/management/keycloak` через
`GET /settings/keycloak` и `PUT /settings/keycloak`. По умолчанию провайдер отключён.
Настройки хранятся в `AdminKeycloakSettings`, а не в переменных `ADMIN_KEYCLOAK_*`.

После развёртывания новой БД форма сразу содержит корпоративные значения:
issuer `https://route66.biocad.ru/realms/biocad`, Redirect URI
`http://localhost:3001/api/auth/callback` и адрес завершения входа
`http://localhost:3001/auth/keycloak/callback`. Client ID пуст, Client Secret отсутствует,
провайдер отключён. Владелец вводит данные клиента и включает вход; для другого
адреса админки меняет оба callback URL. Миграция `20261011170000_corporate_keycloak_defaults`
заполняет начальную пустую запись; ранее сохранённую конфигурацию сохраняет.

| Поле API / интерфейса | Правило |
| --- | --- |
| `enabled` | `false` по умолчанию; `true` требует полной конфигурации и успешной проверки discovery |
| `issuer` | Точный issuer realm, например `https://sso.example.org/realms/starter`; не `.well-known` URL |
| `clientId`, `clientSecret` | Отдельный confidential OIDC client; secret передаётся только при записи |
| `callbackUrl` | Например `https://admin.example.org/api/auth/callback` |
| `frontendCallbackUrl` | Например `https://admin.example.org/auth/keycloak/callback` |
| `version` | Версия из GET, обязательна при PUT; устаревшая версия возвращает 409 |
| `clearSecret` | Явное удаление secret при отключённом провайдере |

Контракт авторизации обоих API — собственный access JWT и сессия на **7 дней
(604800 секунд)** без refresh и продления. TTL не задаётся ни env, ни настройками
Keycloak. Старое поле `sessionTtlSeconds` удалено из settings DTO; при обновлении
существующей БД нужна миграция, одного удаления TTL env недостаточно.

HTTPS обязателен для внешних адресов, HTTP разрешён только для loopback.
Secure cookies выбираются автоматически по callback URL. TLS certificate
validation не отключается никогда. Backend/frontend callbacks должны иметь один origin
(reverse proxy `/api` текущей админки), разные пути и не иметь query/fragment.
Frontend path фиксирован `/auth/keycloak/callback`. CORS разрешает любой origin
(`origin: true`, `credentials: true`), allowlist-переменных нет. Это не отменяет
проверку callback URL; публичные URL не строятся из Host/X-Forwarded-Host.

Канонический backend callback — `/auth/callback`, доступный через proxy как
`/api/auth/callback`. Прежний `/auth/keycloak/callback` также поддерживается для
существующих конфигураций. Оба пути используют один OIDC-обработчик; в запросе
авторизации и при обмене code используется точный `callbackUrl` из БД.

Для локальной админки на порту `3001`:

- Redirect URI (`callbackUrl`): `http://localhost:3001/api/auth/callback`;
- адрес завершения входа (`frontendCallbackUrl`): `http://localhost:3001/auth/keycloak/callback`.

В `Valid redirect URIs` клиента Keycloak добавляется точный backend Redirect URI.
При смене порта или пути обновите оба адреса на странице `/management/keycloak`:
сохранённые настройки не заменяются автоматически. Если issuer и client ID прежние,
повторно вводить сохранённый Client Secret не требуется.

В Keycloak: Standard Flow, PKCE S256, Client Authentication (secret/basic), ID token
signature **RS256**. Точный backend redirect URI без wildcard. Direct Access Grants,
implicit flow и service accounts не нужны. Authorization/token/JWKS endpoints должны
иметь origin issuer. Роли приложения по-прежнему читаются из локальной БД.

Используется `openid-client 6.8.8` с `enableNonRepudiationChecks`: обязательны JWS/JWKS,
issuer, audience, время и nonce, а не decode-only. Node 24 поддерживает `require(esm)`;
backend остаётся CommonJS. Discovery ленивый (кеш 10 минут), timeout запросов 10 секунд,
server-to-server redirects запрещены. Включение проверяет URL, лимиты и discovery;
недоступный issuer не позволяет включить провайдера. Проверка discovery не доказывает
правильность client secret или привязки аккаунта — нужен реальный вход.
Позднейшая недоступность KC не блокирует startup/local login/OpenAPI.

`clientSecret` хранится в БД вместе с остальными настройками провайдера. Внешнего
ключа шифрования и env-переменных Keycloak нет. GET возвращает только `hasSecret`
и `canStoreSecret: true`. Без нового `clientSecret` PUT
сохраняет прежний; при смене issuer/client ID требуется новый secret или удаление старого.
Пустой secret не является командой удаления.

Настройки читаются на запрос, поэтому обновления видны всем API-инстансам без рестарта.
Discovery кешируется по версии. Запись конфигурации, отмена pending OIDC и отзыв всех
SSO-сессий атомарны; local sessions сохраняются. Аудит содержит actor/action/target,
но не значения secret. Через локальный вход можно отключить KC, удалить или заменить
secret. Миграция `20261009140000_keycloak_db_only` отключает прежнюю конфигурацию:
старый зашифрованный secret нужно ввести заново. Она также отменяет pending OIDC
и отзывает SSO-сессии, сохраняя локальные сессии.

Не журналировать query callback, Cookie, Authorization, token response или пароли
на reverse proxy/APM. Backend доверяет всем прокси (`trust proxy: true`).
Admin API остаётся за закрытым входным proxy; никаких frontend env secrets нет.

## Протокол браузера

1. Public `GET /auth/providers` возвращает `{local:true,keycloak:boolean}` без секретов
   и кеширования. Это флаг настройки, а не health-check.
2. Навигация на `/api/auth/keycloak/login?returnTo=/profile` создаёт state/nonce/PKCE
   и browser-bound OIDC-транзакцию (5 минут). Пароль вводится только на стороне KC.
3. Backend callback `/api/auth/callback` одноразово потребляет state перед сетевым обменом, проверяет
   OIDC-ответ. Для новой `(issuer, sub)` атомарно создаёт SSO-only аккаунт USER с `isActive: false`
   и привязку; для существующей проверяет активность аккаунта и отсутствие отзыва.
   Upstream tokens не сохраняются и не выдаются JS.
4. При `isActive: false` регистрация фиксируется, callback возвращает `keycloak_inactive`
   без completion и сессии. Панель объясняет, что вход не разрешён и нужно связаться
   с администратором. Для активного аккаунта callback устанавливает **только completion cookie** и возвращает на фиксированный
   frontend `/auth/keycloak/callback?result=success&returnTo=<path>` либо
   `?result=error&error=keycloak_unavailable|keycloak_denied|keycloak_invalid|keycloak_inactive`.
   Code/token/raw provider error не включаются в frontend URL.
5. Frontend вызывает `POST /api/auth/keycloak/complete` без тела **один раз под общей
   межвкладочной блокировкой**, с Origin, X-CSRF-Protection: 1 и временными cookies
   (`credentials: 'include'` при fetch). Получает access JWT в JSON, без auth-cookie.
   После успешного обмена подтверждает `/auth/me` через Bearer JWT и открывает приватный UI.
   `/auth/refresh` отсутствует; после истечения JWT нужен новый вход.

Отозванная identity или отмена входа — `keycloak_denied`, аккаунт с запрещённым входом —
`keycloak_inactive`, неверный
или повторный callback — `keycloak_invalid`, недоступность провайдера/БД —
`keycloak_unavailable`. При disabled OIDC endpoints возвращают 404.
Неверный/просроченный/повторный completion — `401 KEYCLOAK_COMPLETION_INVALID`.
После потери ответа complete начать новый вход, не повторять запрос: ответ мог быть
потерян уже после commit. Неиспользуемая сессия ограничена TTL. Ошибка complete не
отзывает ранее действовавшую сессию. Временные cookies очищаются.

`returnTo` — относительный app URL **с query и hash**, default `/`. Входное и
нормализованное значения ограничены 2048 символами. Неизвестный безопасный path
разрешён: отсутствие страницы обрабатывает обычный router 404, не auth allowlist.

- Express однократно декодирует **внешний** параметр `returnTo`. Backend сначала
  выделяет path по первому `?`/`#`, а не декодирует весь URL ещё раз.
- Только path декодируется один раз для проверки и нормализации. Запрещены абсолютные
  и protocol-relative URL, backslash, whitespace/control, malformed escapes/UTF-8,
  encoded separators (`/`, `\\`, `?`, `#`, `%`) и двойное encoding через `%25`.
  Dot-segments `.`/`..`, в том числе encoded и `/a/..//evil`, запрещены. Безопасные
  encoded символы и UTF-8 path нормализуются, но не могут скрыть запрещённый маршрут.
- Нормализованный path проверяется без учёта регистра: `/api`, `/auth/callback`, `/auth/keycloak`,
  `/sign-in` и их подмаршруты запрещены, включая варианты с query/hash и encoded
  именами. Похожие, но другие пути (`/apiary`, `/sign-in-help`) не запрещаются.
- Query/hash остаются **данными**, не декодируются повторно и не проверяются как
  path. Encoded spaces/UTF-8 и URL-подобные значения сохраняются; raw spaces/UTF-8
  сериализуются стандартным URL encoding. Literal backslash/control/line-break
  characters запрещены во всём входном значении. Encoded данные query/hash не
  создают path, новый origin или заголовок ответа.

Примеры значения, получаемого helper **после** внешнего query-декодирования:

```text
/profile?name=Ivan%20Petrov#details                 → то же значение
/profile#details                                 → то же значение
/profile?name=%D0%98%D0%B2%D0%B0%D0%BD#%D0%B8%D0%BC%D1%8F → то же значение
/profile?next=https%3A%2F%2Fexample.org%2Fa#details  → то же значение (next — данные)
/%70rofile?tab=security#details                    → /profile?tab=security#details
/a/..//evil                                      → отказ
/%2573ign-in                                     → отказ
/%73ign-in?next=%2Fprofile#details                 → отказ
```

Frontend передаёт `pathname + search + hash` как одно значение через
`URLSearchParams`, а не конкатенирует незакодированный `#` с login URL. Например:

```text
/api/auth/keycloak/login?returnTo=%2Fprofile%3Fname%3DIvan%2520Petrov%23details
```

Здесь Express получает `/profile?name=Ivan%20Petrov#details`; `%2520` во внешнем
query нужен, чтобы внутренний `%20` сохранился. При возврате backend аналогично
кодирует всё значение через `URLSearchParams`; frontend извлекает его один раз.

Browser-binding cookie: HttpOnly, SameSite=Lax, 10 минут; completion-cookie — до
60 секунд. SameSite фиксирован, env-переключателя нет. HTTPS callback из БД включает
Secure и префикс `__Host-`; для локального HTTP они выключены. Path=/, без Domain.
Это только временные OIDC cookies, не основной способ авторизации API.
Grant истекает не позднее OIDC-транзакции.
SHA-256 hashes state/binding/grant хранятся в БД; PKCE/nonce остаются
только до завершения/очистки обмена. Новая попытка входа заменяет pending flow браузера;
конфликтующие вкладки могут потребовать повторного входа, но не меняют текущую
авторизацию до координированного complete. Local login/logout отменяют pending flow
своего браузера, не обращаясь к Keycloak.

Проверка аккаунта/identity/authVersion, consumption, создание сессии и подпись JWT
входят в одну транзакцию под user/identity locks. `AccessGuard`/`AdminPermissionsGuard`
проверяют доступ на защищённых запросах. JWT и сессия имеют один срок;
refresh-токены не выдаются, активность пользователя не продлевает сессию.

## Создание аккаунта при первом входе

После проверки подписи, issuer, audience, nonce, state и PKCE новая `(issuer, sub)`
получает аккаунт USER без локального пароля с `isActive: false`. Логин — независимый `kc-<UUID>`.
Создание аккаунта, identity и аудита `account.keycloak.create` атомарно;
общая системная блокировка сериализует параллельные входы и ручные привязки.
Отказ или отмена до проверки identity не создают аккаунт.

Запрашиваются scopes `openid profile`. Имя берётся только из проверенного ID token:
`name` → `given_name + family_name` → `preferred_username` → «Пользователь Keycloak».
Пробелы нормализуются, управляющие символы удаляются, длина ограничена 120 символами.
Наличие профильных claims зависит от client scope/mappers Keycloak.
Имя заполняется при создании; последующие входы не перезаписывают локальный профиль.

Повторный вход находит тот же аккаунт. Роли, email и username провайдера не объединяют
аккаунты и не повышают локальные права. Отозванная identity остаётся занятой;
её восстановление выполняет OWNER. Отключённый аккаунт не создаётся заново.
Фото и email не сохраняются в текущей модели аккаунта. USER получает только права
собственного аккаунта; управление командой и Keycloak ему недоступно.

`authValidAfter` нового SSO-only аккаунта равен epoch: отзывов ещё не было, а первый
flow уже начат до регистрации. Ручная привязка, восстановление и любые изменения
credentials/прав устанавливают актуальную границу отзыва и инвалидируют прежние flow.

## Ручная привязка существующего аккаунта

Для нового аккаунта Keycloak администратор открывает `/management/users`, выбирает
пользователя и включает «Разрешить вход». Используется только существующий `isActive`:
отдельного поля активации нет. После этого пользователь начинает новый вход.
Чтение списка требует `accounts.read`, включение — `accounts.activate`.
Оба права доступны ADMIN и OWNER; дополнительной роли можно назначить их отдельно.
Операция `POST /access/users/:id/activate` принимает `{version}`, включает только вход,
проверяет наличие способа аутентификации, повышает authVersion и пишет аудит.
Параллельное/повторное включение со старой версией возвращает 409.
Назначение роли, изменение credentials и отключение аккаунта остаются действиями OWNER.

OWNER получает точный неизменяемый `sub` пользователя из KC. Username/email/roles
claims для идентификации или полномочий не используются. Issuer/subject —
идентификаторы, не токены. Привязки доступны в `/management/users` у выбранного аккаунта,
в блоке «Способы входа и сессии». Служебный CLI удалён.

1. Создать аккаунт в интерфейсе с нужной ролью и первоначальным локальным паролем.
2. Выбрать аккаунт и привязать issuer + sub пользователя Keycloak.
3. Проверить вход через Keycloak; при необходимости отключить локальный пароль.
4. Для отзыва использовать «Отозвать привязку», «Завершить все сессии» или отключить аккаунт.

| Метод | Путь | Действие, только OWNER |
| --- | --- | --- |
| POST | `/access/users/:id/identities` | Привязать `{issuer, subject}` |
| DELETE | `/access/users/:id/identities/:identityId` | Отозвать привязку |
| DELETE | `/access/users/:id/local-password` | Отключить локальный пароль |
| DELETE | `/access/users/:id/sessions` | Отозвать все сессии и pending OIDC |

`GET /access/users` возвращает активные привязки. Bind сохраняет роль и локальный
пароль существующего аккаунта. Identity уникальна
по `(issuer,subject)`, unbind делает мягкий отзыв; даже отозванную identity нельзя
автоматически перенести другому аккаунту. Повторный активный bind и unbind
идемпотентны. Изменение привязок, отключение local, активности, revoke-sessions и
смена пароля отзывают все сессии и прежнюю pending OIDC-аутентификацию.

Последний способ входа активного администратора удалить нельзя: сначала deactivate
либо добавить альтернативу. Для SSO-only локальный вход выполняет dummy verification
и возвращает общий отказ 401; смена пароля — 403 LOCAL_PASSWORD_UNAVAILABLE.
Поле `/auth/me.hasLocalPassword` позволяет скрыть форму. Наличие local рядом с SSO
**не обеспечивает обязательность MFA KC**: отключите local у нужных аккаунтов.
До disable-local проверить действующий вход через сконфигурированный issuer и наличие
другого доступного оператору администратора; одна запись identity не доказывает
доступность Keycloak или правильность его deployment-конфигурации.

## Logout, блокировки, обслуживание

`POST /auth/logout` с Bearer JWT отзывает текущую сессию; клиент удаляет свой токен.
Для браузерных login/logout нужны корректный HTTP(S) Origin и X-CSRF-Protection: 1,
без allowlist. Передача временных OIDC cookies позволяет отменить pending flow браузера.
Logout **локальный**, не зависит от KC. Нет global SSO/back-channel logout или
мгновенного применения блокировки пользователя в KC. Срок собственной сессии приложения
по общему контракту — 7 дней без продления, после чего нужен новый OIDC-вход.
Живая SSO-сессия KC может выполнить его без пароля. Немедленную
локальную блокировку дают отключение аккаунта и отзыв сессий через UI/API; роли остаются локальными.
Сохранение настроек через API, включая отключение, закрывает старые OIDC flows и
отзывает ранее выданные SSO-сессии. Это не завершает внешнюю сессию Keycloak.
Аварийный local admin — явная операционная политика, не автоматический fallback.

SessionCleanupService автоматически очищает истёкшие сессии и временные OIDC records
при запуске API и раз в минуту. Каждый API обслуживает свой контур; проверки TTL не
зависят от очистки. В новой авторизации нет refresh-ротации или истории её replay.
OWNER меняет доступ через UI/API, а не прямые SQL updates,
обходящие authVersion/отзыв.

Миграция `20261007120000_admin_keycloak` сохраняет local passwords и сессии, не
меняет Client-модели. Применять перед rollout Admin API. Откат старого кода после
создания SSO-only аккаунтов требует отдельного плана данных, down/reset не выполняются.
