# Приёмка Admin local + Keycloak

После `20261009120000_admin_permissions_settings` конфигурация задаётся OWNER через
API/интерфейс, а не ADMIN_KEYCLOAK_* env. Исторические отчёты от 2026-10-07 ниже
описывают прежнюю версию и не являются подтверждением новых ролей/настроек.
Актуальная матрица дополнительных сценариев — `admin-access.md`.
Служебный CLI впоследствии удалён; актуальная приёмка замены его операций — `backend-startup-qa.md`.

## Граница и безопасная среда

Не запускать сценарии на пользовательской БД. Требуются отдельная PostgreSQL,
явные `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
`DOTENV_CONFIG_PATH=/dev/null`, независимые
тестовые CLIENT/ADMIN JWT secrets. Только свои контейнеры/порты/volumes. Для браузера
нужен доверенный HTTPS origin с `/api` reverse proxy; секреты не передавать frontend.
Автоматические тесты и тестовая инфраструктура в репозиторий не добавлены.

В отдельной базе применить миграции и запустить Admin API для создания владельца.
Через интерфейс создать SSO-only USER и привязать проверенный `(issuer, sub)` второго
пользователя к local admin. Не подставлять email/username вместо `sub`.

## Обязательные ручные сценарии

1. Настройки в БД имеют `enabled: false`: providers `{local:true,keycloak:false}`, no-store,
   local login/me/refresh/logout работают, Keycloak endpoints — 404.
2. Ранее включённая конфигурация, затем недоступный issuer: API стартует, providers true,
   вход KC возвращает безопасный `keycloak_unavailable`, local login работает.
3. Login navigation создаёт PKCE S256/state/nonce; callback даёт только временные
   cookies и `result=success`. Существующий admin refresh до complete не изменён.
4. Complete без тела под origin/CSRF: прежний AccessTokenDto, новый HttpOnly refresh,
   временные cookies очищены. `/auth/me` показывает ожидаемые локальные роль/login/id,
   `hasLocalPassword`, но не hash/identity tokens. SSO-only имеет false и USER.
5. Неверные/пропущенные/повторные state, PKCE, nonce; неверная signature/issuer/audience,
   просроченный или отсутствующий ID token: сессия не создаётся. Неизвестный subject,
   inactive/unlinked аккаунт — denied, без JIT/нового OWNER. Отмена KC — denied.
6. State/grant не работают из другого браузера. Отсутствующие/чужие Origin или CSRF
   не допускают complete. Повторный/просроченный grant — 401, две конкурентные попытки
   создают ровно одну сессию. Потеря ответа требует нового входа, не retry.
7. `/a/..//evil`, `//evil`, encoded separators/control и двойное encoding **в path**,
   абсолютные URL, возвраты на `/api`, `/auth/keycloak` и `/sign-in` запрещены
   (включая encoded имена, регистр и query/hash). Literal backslash/control запрещены
   во всём URL. Host/forwarded-host не меняют redirect.
   `/profile?name=Ivan%20Petrov#details`, `/profile#details`,
   UTF-8 query/hash и URL-подобные query data сохраняются. Неизвестный безопасный
   app path передаётся router 404. Проверить round-trip через внешнее encoding
   `returnTo` в login URL и в callback URL без decode-all и потери hash.
8. Старый refresh после ротации отзывает сессию; JWT прекращает доступ. KC TTL фиксирован
   и не больше ADMIN_SESSION_TTL. `expiresIn` JWT использует существующее округление
   до секунд; точная граница `sessionExpiresAt` всегда дополнительно проверяется в БД.
9. Client JWT не допускается в Admin API, Admin JWT — в Client API; client registration,
   login/me и исходный OpenAPI/SDK не изменены.
10. Unbind, disable-local, deactivate, revoke-sessions и смена local password отзывают
    доступ и pending completion. Callback, начатый до отзыва, не восстанавливает доступ.
    Identity нельзя перенести к другому администратору. Активный аккаунт нельзя оставить
    без способа входа. SSO-only local login — 401, смена пароля — 403.
11. Logout во время code exchange отменяет flow: поздний callback не создаёт grant.
    Logout не зависит от KC. Повторный вход через ещё живую SSO-сессию — ожидаемое
    поведение, а не подтверждение global logout.
12. В браузере: две вкладки, отмена входа, поздний callback после local login/logout,
    callback reload/back, очистка storage, сетевой обрыв complete/refresh, восстановление
    и подтверждение `/auth/me`. Приватный интерфейс до подтверждения не открывается.
13. С реальным Keycloak: exact redirect URI, confidential client/basic, PKCE S256,
    RS256, MFA/required actions, смена JWKS, отключение пользователя и истечение своей
    сессии. Проверить отсутствие токенов в URL/storage/logs и Secure/HttpOnly/SameSite
    cookies за production reverse proxy.

## Фактически выполнено исполнителем (2026-10-07)

- Node `v24.18.1`, `openid-client 6.8.8`: CommonJS require проверен отдельно и реальным
  запуском собранного Admin API; ESM/webpack runtime несовместимость не обнаружена.
- `prisma validate`, `check-types` (включая generate), `lint`, `build` обеих точек входа.
- Изолированная PostgreSQL 16: свой контейнер `turbo-admin-oidc-engineering-20261007-7ec1`,
  tmpfs, без пользовательских volumes, динамический порт `127.0.0.1:32768`. Все 20
  миграций применены; `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
  вернул `No difference detected`. Выполнены seed, SSO-only create и bind через CLI.
- OpenAPI штатным exporter, Admin SDK штатным `rest-api-codegen@5.2.4`, SDK typecheck/build.
  `client.openapi.json`, Client API source и Client SDK — без diff.
- Временный HTTPS OIDC protocol fixture с RSA/JWKS и reverse proxy вне репозитория:
  успешный вход и completion, local при disabled/cold outage, signature/nonce/issuer/
  audience/expiry/missing-ID failures, unbound/denied/unavailable, binding/CSRF/replay,
  срок transaction/grant, refresh reuse, logout, обе стороны client/admin изоляции,
  concurrent complete (200 + 401), pending revoke/deactivate/unbind/disable-local,
  запрет identity transfer и logout во время token exchange — прошли.
- Дополнительно под реальной блокировкой AdminUser проверен local login, уже
  проверивший пароль и ожидающий lock: операторский отзыв не позволяет ему выдать
  новую сессию. Смена local password по HTTP отзывает старый JWT и pending completion,
  старый пароль перестаёт работать, новый принимается. Заявленная провайдером роль
  OWNER не повышает локальный SUPPORT. Команда sessions:cleanup выполнена на своей БД.
- Проверены конфигурационные ограничения: TTL cap, production HTTPS, явный dev-loopback
  HTTP, одинаковый callback origin, отключённая конфигурация без KC-зависимости.
- После проверки свои backend/HTTPS fixture процессы остановлены, временные скрипт,
  сертификат/ключ, PostgreSQL container/tmpfs и загруженный для него image удалены.
  Проверочный сервер или БД не оставлены работающими.

**Ограничения:** это не E2E реального Keycloak. Его realm/client configuration, MFA,
required actions, фактическая ротация ключей и корпоративный reverse proxy не проверены.
Браузерный frontend lifecycle/визуальная приёмка принадлежат отдельному владельцу.
Миграции проверены на новой отдельной БД; upgrade копии production-данных отдельно
согласуется. Ни один результат protocol fixture не доказывает готовность реального KC.

## Дополнительная проверка поправки returnTo

После восстановления прерванной сессии проверены фактические частичные изменения;
основная реализация auth/SDK повторно не изменялась. Поправка ограничена
`src/infrastructure/auth/admin-oidc/oidc-values.ts` и этой документацией.

- Исполнение helper через Node + ts-node: **28 допустимых и 64 отклоняемых примера**,
  default `/`, идемпотентность нормализации, сохранение origin и round-trip внешнего
  query-параметра `returnTo` в login/callback URL — прошли. Включены `%20`, `+`, UTF-8
  query/hash, raw UTF-8/spaces с URL serialization, фрагменты, пустые `?`/`#`, encoded
  query data, неизвестные app paths, граница 2048 и увеличение длины при нормализации.
- Отклонены absolute/protocol-relative URL, backslash/control, encoded/double-encoded
  опасные path-компоненты, malformed path escapes/UTF-8, dot-segments и циклические
  `/api`, `/auth/keycloak`, `/sign-in` с разными регистрами/encoding/query/hash.
- `pnpm run lint`, `pnpm run check-types`, `pnpm run build` — прошли (включая штатную
  Prisma generation и сборку обеих точек входа). Использованы
  `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`, `DOTENV_CONFIG_PATH=/dev/null`,
  `NODE_ENV=production` и явный неиспользуемый `DATABASE_URL`; обращения к БД не нужны.
- SDK/OpenAPI не регенерировались. App runtime, HTTP flow и browser navigation
  **в этой поправке не запускались**: их end-to-end проверка остаётся у независимого QA.
  QA PostgreSQL 25432, Keycloak 28080 и их контейнеры не использовались/не останавливались.
  Временный проверочный скрипт вне репозитория удалён после проверки;
  автотестовая инфраструктура не добавлялась.

## Заключительная независимая QA — 2026-10-07

**Источник: QA-agent, вердикт PASS; результат принят оркестратором.** Проверки ниже
выполнены независимым QA, не engineering-agent. История HTTPS protocol fixture выше
сохранена отдельно и не подменяет этот live-результат. Источник — несекретный отчёт
`/tmp/opencode/qa-admin-auth-20261007t095429z/final-phase/FINAL-QA.md` и указанная в нём
миграционная фаза `../backend-phase/BACKEND-QA.md`; сохранность временных evidence после cleanup не гарантируется.

### Среда и подтверждённые сценарии

- Настоящий официальный **Keycloak 26.8.0**, PostgreSQL 16, Node 24.18.1;
  отдельный Chromium 153.0.8010.12 / Playwright 1.63.0. Собственные tmpfs и loopback
  dev HTTP-стенд с явным разрешением HTTP; core browser E2E без mocks/interception.
- Local OWNER: login, профиль, reload/refresh restore, logout 204 и удаление cookie;
  `hasLocalPassword=true`. KC OWNER и SSO-only SUPPORT проходят реальную форму KC,
  callback, ровно один complete, `/auth/me`, reload и logout. У SSO-only
  `hasLocalPassword=false`, есть пояснение в UI, local password login возвращает 401.
- Противоположные назначения ролей KC не меняют локальные OWNER/SUPPORT. Unlinked
  identity даже при совпадении username и inactive local account получают denied,
  без новых пользователей/сессий. CLI revoke блокирует access и pending completion.
- Callback выдаёт только completion-cookie, refresh появляется после complete;
  bootstrap refresh до complete отсутствует, StrictMode/SWR scope не повторяют POST.
  Credentials не найдены в localStorage/sessionStorage/URL, refresh недоступен JS.
- Повтор code/state callback отклонён; подменённый state не потребляет правильный.
  Проверены отсутствующий/чужой browser binding и Origin/CSRF: ожидаемые 401/403.
  Два concurrent complete с одним grant дают **200 + 401 и ровно одну AdminSession**;
  следующий replay — 401. Expired transaction/grant отклонены после адресного
  переноса собственных DB deadlines в прошлое, **не ожиданием полного TTL**.
- Оба frontend P2 закрыты независимым повтором: local и KC сохраняют
  `/profile?name=Ivan%20Petrov#details`, URL-подобное query и percent-encoded UTF-8
  query/hash. Отказ completion во второй вкладке не закрывает профиль первой и
  не уничтожает origin-wide ready marker; явный logout после restore закрывает обе.
- KC disabled: providers/local UI корректны, KC navigation 404, local работает.
  При paused KC cold Admin API стартует, local login/logout работают до и после
  ошибки KC; безопасный unavailable без raw payload. Серверный logout занял **117 ms**.
- Фиксированный KC TTL **8 секунд** (admin max 20, access TTL 2): DB срок 7.994 секунды,
  серия refresh с **5 выдачами credentials** сохраняет один deadline. После истечения
  UI закрыт, access/refresh — 401. Реальный Client register/login/profile/update/
  refresh/logout прошёл; JWT и имена/значения cookies изолированы между двумя API.
- Fresh: все 20 миграций и повторный deploy, schema diff пуст. Upgrade применяет
  только `20261007120000_admin_keycloak`; прежние поля шести моделей совпали полностью,
  включая Argon2 hashes, роли, даты, BROWSER/MOBILE sessions и refresh hashes.
  Старые AdminSession имеют identityId=NULL; Client password остаётся NOT NULL.
- Независимые backend/frontend lint, types и production builds прошли. Frontend
  предупреждение chunk >500 kB: **590.45 kB**, неблокирующее. Desktop light и mobile
  dark проверены без горизонтального overflow и page errors в завершённых сценариях.

### Границы доказательства и очистка

RS256/client-basic/PKCE/state/nonce и обязательная JWS/JWKS-проверка подтверждены QA
**статически**; положительный flow прошёл с настоящей RSA-подписью KC. Независимые
негативные подмены signature/audience/nonce/ID-token expiry в настоящем KC не выполнялись;
предыдущие fixture-проверки engineering-agent не приписываются независимому QA.
Не проверены корпоративный production KC, MFA/required actions, JWKS rotation,
production HTTPS reverse proxy/cookies, все bfcache/сетевые гонки и браузерная матрица.
Global SSO/back-channel logout отсутствует по контракту: локальный выход не завершает KC SSO.
QA закрыл свои app/browser процессы, удалил контейнеры PG/KC и сеть по owner-label;
все пять портов стенда свободны. Synthetic secrets удалены, tmpfs БД/realm уничтожены.
Остались только несекретные временные отчёты/сценарии/скриншоты и build/tool caches;
общие Docker images/cache и чужие ресурсы не затронуты. Секреты/персональные данные сюда не переносились.
