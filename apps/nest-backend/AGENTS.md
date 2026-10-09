# NestJS backend

- Общаться и документировать по-русски. Пакет `@oim/nest-backend` — каркас
  аккаунтов и сессий, Node.js >= 24, pnpm workspace. Изображения, S3, кроп,
  очереди и другие продуктовые модули не входят в текущий объём.
- По решению пользователя **не создавать автоматические тесты и тестовую
  инфраструктуру**. Проверки: `lint`, `check-types`, `build`, адресные ручные
  HTTP-сценарии. `typecheck` — совместимый alias для `check-types`.
- В параллельной работе установку зависимостей и изменение lockfile выполняет
  назначенный владелец. Для проверок через pnpm 11 задавать
  `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`, чтобы `run`/`exec` не запускали
  неявный workspace install. Если зависимостей не хватает, передать это владельцу,
  а не менять общую build-script policy самостоятельно.
- HTTP-контроллеры принадлежат `src/client-api` или `src/admin-api`, правила
  аккаунтов — `src/modules`, конфигурация, HTTP, auth и Prisma — `src/infrastructure`.
- Два независимых entrypoint: client API на 3001 и admin API на 3002; оба по умолчанию слушают `0.0.0.0`.
  Из корня: `pnpm --filter @oim/nest-backend <команда>`.
  `dev:client` / `dev:admin`, `build:client` / `build:admin` и
  `start:client` / `start:admin` работают отдельно. `dev`, `build` и `start`
  запускают оба API; `start:client` / `start:admin` используют собранный `dist`.
  `start:prod` — совместимый alias для `start:client`.
- ClientAppModule подключает SecurityModule, ClientAuthModule и ClientUsersHttpModule.
  AdminAppModule подключает SecurityModule, AdminAuthModule и управление доступом;
  AdminPermissionsGuard проверяет права. Клиентские и административные JWT/сессии не взаимозаменяемы.
  JWT issuer/audience: `starter:client-api` / `starter:client` и
  `starter:admin-api` / `starter:admin`. Секреты каждого API независимы.
  JWT возвращается только в JSON, защищённые запросы используют Bearer, не cookie.
  `ApiConfig.accessTtlSeconds` фиксирован: 604800 (7 дней) для обоих API; срок сессии
  равен сроку JWT. TTL env, `ApiConfig.sessionTtlSeconds` и refresh не используются;
  `/auth/refresh` удалён, logout через Bearer отзывает текущую сессию.
- Закрытые административные endpoint'ы требуют явного `@AdminPermissions`;
  без метаданных доступ запрещён даже OWNER. Каталог действий — `modules/admin-access`.
  Роли в БД: OWNER — все действия, ADMIN — все несистемные, USER — собственный аккаунт.
  Default нового аккаунта — USER, первоначальный admin/admin — OWNER; обязательной смены пароля нет.
  Встроенные роли неизменяемы; дополнительные роли и назначения управляются OWNER через /access.
  Системные permissions не делегируются. Последний активный OWNER защищён от отключения/понижения.
- CORS разрешает любой origin и запрашиваемые заголовки: `origin: true`, `credentials: true`, без allowlist env
  и `ApiConfig.allowedOrigins`. Не использовать `*` вместе с credentials.
  Оба API доверяют всем прокси: `trust proxy: true`, без `*_TRUSTED_PROXIES` env.
  Браузерные login/logout сохраняют корректный HTTP(S) Origin и X-CSRF-Protection: 1,
  без allowlist. `/auth/keycloak/complete` также требует эти заголовки и временные
  HttpOnly cookies; logout дополнительно требует Bearer JWT текущей сессии.
  В `ApiConfig` нет настроек cookies. Временные OIDC cookies используют Secure и
  префикс `__Host-` при HTTPS callback из БД; SameSite фиксирован Lax. Cookie env нет.
  Настройки backend не зависят от `NODE_ENV`, Swagger по умолчанию включён.
- Prisma содержит ClientUser, AdminUser, ClientSession,
  AdminSession, AdminIdentity, AdminOidcTransaction и
  AdminOidcCompletion, AdminAccessRole, AdminKeycloakSettings и AdminSecurityAudit;
  enum — SessionTransport. Старый SUPPORT мигрирует в дополнительную роль без повышения прав.
  Refresh-модели удалены; обновление существующей БД требует миграции.
  `SessionTransport.MOBILE` сохраняется для исторических сессий, мобильных
  HTTP-контроллеров нет. Логин клиента нормализуется в нижний регистр на уровне
  аккаунтов; в БД он уникален и ограничен 64 символами.
- Менять схему только вместе с **новой миграцией**. Исторические миграции не
  переписывать. Очищающая миграция удаляет продуктовые данные безвозвратно,
  сохраняя аккаунты и сессии. Не применять её к существующей БД, не сбрасывать
  БД/volumes без отдельного разрешения. Новый запуск проверять на отдельной БД.
  `prisma:generate`, `prisma:migrate`, `prisma:deploy` — команды работы со схемой.
  Служебного CLI и seed нет: AdminBootstrapService автоматически создаёт владельца
  при запуске Admin API, если таблица AdminUser пуста. Повторный запуск не меняет credentials.
  SessionCleanupService при запуске и раз в минуту удаляет только истёкшие записи
  своего API; проверки срока JWT/сессии не зависят от фоновой очистки.
- OpenAPI менять через DTO/контроллеры и `src/infrastructure/http/openapi.ts`.
  `openapi:generate` экспортирует `openapi/client.openapi.json` и
  `openapi/admin.openapi.json` без подключения к БД. `src/generated/prisma`
  принадлежит `prisma generate`, SDK generated — соответствующему codegen;
  вручную их не редактировать. После изменения HTTP-контракта согласовать
  генерацию SDK с его владельцем, затем проверить типы и сборку потребителей.
- JWT secrets — в окружении; defaults каркаса — client-secret/admin-secret.
  Секреты должны быть непустыми и разными. Client secret Keycloak хранится в БД,
  API позволяет только его запись; внешнего ключа шифрования нет.
  `.env` повторяет структуру `.env.example`, отличаться могут только значения.
  При синхронизации сохранять действующие значения; примеры `.env.example` и `env.example`
  вести идентично. Общие правила и `env:check` описаны в корневом AGENTS.md. При проверках с Prisma/ts-node
  отключать чтение env-файлов через `DOTENV_CONFIG_PATH=/dev/null`: эта настройка заменяет
  и локальный `.env`, и `infra/dev/.env`. Для изолированной среды явно задавать `POSTGRES_HOST`,
  `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
  `DATABASE_URL` не читается; Prisma CLI и оба API используют общий `databaseUrl()`.
  Единые defaults — localhost:5544, user/password, база default-db.
  Проверки validate/generate/build не требуют работающей БД.
- Keycloak относится только к Admin API. Local login всегда сохраняется;
  upstream tokens не хранятся. Callback выдаёт только временный grant, а
  `/auth/keycloak/complete` под browser origin/CSRF guard атомарно создаёт сессию.
  `AdminUser.passwordHash` nullable, ClientUser неизменен. Привязка issuer+sub
  только OWNER через /access/users/:id/identities, без JIT/email-link/автоматического OWNER. Изменения credentials,
  identity и активности выполняются под user lock с authVersion/отзывом сессий.
  Logout локальный; ограничения TTL/SSO и управление через UI/API описаны в `docs/admin-keycloak.md`.
  Отдельного Keycloak `sessionTtlSeconds` в settings DTO нет; срок собственных
  JWT/сессий приложения равен общему `ApiConfig.accessTtlSeconds` (7 дней).
  Настройки Keycloak читаются из БД на запрос, а не из ADMIN_KEYCLOAK_* env.
  OWNER изменяет их через /settings/keycloak, secret write-only.
  Изменение версии отменяет OIDC flows и отзывает SSO-сессии.
  Общая системная блокировка всегда берётся до user locks; системные изменения журналируются без секретов.
