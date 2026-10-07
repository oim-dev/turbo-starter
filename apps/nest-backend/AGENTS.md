# NestJS backend

- Общаться и документировать по-русски. Пакет `@repo/nest-backend` — каркас
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
- Два независимых entrypoint: client API на 3001 и admin API на 3002.
  Из корня: `pnpm --filter @repo/nest-backend <команда>`.
  `dev:client` / `dev:admin`, `build:client` / `build:admin` и
  `start:client` / `start:admin` работают отдельно. `dev`, `build` и `start`
  запускают оба API; `start:client` / `start:admin` используют собранный `dist`.
  `start:prod` — совместимый alias для `start:client`.
- ClientAppModule подключает SecurityModule, ClientAuthModule и ClientUsersHttpModule.
  AdminAppModule подключает SecurityModule и AdminAuthModule; AdminRolesGuard
  сохраняется. Клиентские и административные JWT/сессии не взаимозаменяемы.
  JWT issuer/audience: `starter:client-api` / `starter:client` и
  `starter:admin-api` / `starter:admin`. Секреты каждого API независимы.
- Закрытые административные endpoint'ы требуют явного `@AdminRoles`;
  без метаданных доступ запрещён. `AdminRole` сохраняет `OWNER` и `SUPPORT`,
  default — `OWNER`; HTTP-управления сотрудниками в каркасе нет.
- CORS и BrowserOriginGuard используют один `ApiConfig.allowedOrigins`.
  Настройка: `CLIENT_ALLOWED_ORIGINS` / `ADMIN_ALLOWED_ORIGINS`, точные HTTP(S)
  origins через запятую без пути и wildcard. Development defaults перечислены
  в `env.example`, production defaults пусты. Для Swagger включайте собственный
  origin API. Браузерные auth-запросы требуют Origin и X-CSRF-Protection: 1.
- Prisma содержит только ClientUser, AdminUser, ClientSession, ClientRefreshToken,
  AdminSession и AdminRefreshToken; enum — AdminRole и SessionTransport.
  `SessionTransport.MOBILE` сохраняется для исторических сессий, мобильных
  HTTP-контроллеров нет. Логин клиента нормализуется в нижний регистр на уровне
  аккаунтов; в БД он уникален и ограничен 64 символами.
- Менять схему только вместе с **новой миграцией**. Исторические миграции не
  переписывать. Очищающая миграция удаляет продуктовые данные безвозвратно,
  сохраняя аккаунты и сессии. Не применять её к существующей БД, не сбрасывать
  БД/volumes без отдельного разрешения. Новый запуск проверять на отдельной БД.
  `prisma:generate`, `prisma:migrate`, `prisma:deploy`, `prisma:seed` — команды пакета;
  seed создаёт начальную административную учётную запись, а не продуктовые данные.
- OpenAPI менять через DTO/контроллеры и `src/infrastructure/http/openapi.ts`.
  `openapi:generate` экспортирует `openapi/client.openapi.json` и
  `openapi/admin.openapi.json` без подключения к БД. `src/generated/prisma`
  принадлежит `prisma generate`, SDK generated — соответствующему codegen;
  вручную их не редактировать. После изменения HTTP-контракта согласовать
  генерацию SDK с его владельцем, затем проверить типы и сборку потребителей.
- Секреты только в окружении. Пользовательский `.env` не читать и не менять;
  примеры вести в `env.example`. При проверках с Prisma/ts-node отключать чтение
  dotenv через `DOTENV_CONFIG_PATH=/dev/null`; `NODE_ENV=production` отключает
  загрузку `infra/dev/.env`, `DATABASE_URL` задавать явно для изолированной среды.
  Проверки validate/generate/build не требуют работающей БД.
