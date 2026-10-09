# Next Web App

Нейтральное стартовое приложение `@oim/next-web-app` на Next.js 16 App Router,
React 19, TypeScript и Mantine 8. Архитектура и блокирующий протокол разработки — в [AGENTS.md](AGENTS.md).

## Запуск

Нужны Node.js 24 и pnpm версии из `packageManager` корневого `package.json`.
После подготовки зависимостей workspace команды выполняются из корня репозитория:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run web:dev
```

Откройте <http://localhost:3005>. Единственная прикладная страница `/` рендерится на сервере
и **не вызывает API**. Для её работы не нужны запущенный backend, база данных или файловое хранилище.
Неизвестные адреса показывают нейтральный экран 404 с возвратом на главную.

Корневые команды `web:dev`, `web:lint`, `web:check-types` и `web:build` запускаются через Turborepo:
зависимость `^build` автоматически подготавливает `dist` SDK до команды приложения.
SDK собирается из уже сгенерированных исходников: запуск backend и повторная генерация OpenAPI
для обычной работы сайта не требуются. При прямом запуске команды пакета в обход Turborepo
SDK нужно предварительно собрать через
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --filter @oim/client-rest-api-sdk run build`.

## Проверки и production

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run web:lint
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run web:check-types
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run web:build
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run web:start
```

`typecheck` оставлен как alias для `check-types`. Next.js 16 не запускает ESLint внутри `build`.
Все команды используют порт 3005 там, где требуется HTTP-сервер. Не запускайте dev и start на одном порту одновременно.
Проверки не должны автоматически менять зависимости и lockfile, поэтому указан
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`.

Для локальных `build/start` используется обычный output Next.js. [Dockerfile](Dockerfile)
включает `output: 'standalone'` через `NEXT_STANDALONE=1`, собирает SDK и приложение,
копирует standalone output и статические чанки, затем запускает `apps/next-web-app/server.js`.
Docker-сборка выполняется с контекстом корня репозитория и требует актуального workspace lockfile.

### Альтернативный каталог сборки

`NEXT_DIST_DIR` задаёт каталог результата относительно `apps/next-web-app`; по умолчанию это `.next`.
Для обычной локальной сборки в отдельный каталог используйте одинаковое значение при build и start:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false NEXT_DIST_DIR=build/preview pnpm run web:build
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false NEXT_DIST_DIR=build/preview pnpm run web:start
```

`NEXT_STANDALONE` и `NEXT_DIST_DIR` учитываются в environment hash задачи Turbo `build`.
Результаты под `.next/` и `build/` покрыты настроенными `outputs`. Для другого кастомного `distDir`
сначала согласуйте покрытие `outputs` с владельцем корневой конфигурации либо запускайте
`pnpm --filter @oim/next-web-app run build` напрямую, без кеширования Turborepo,
с `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` и предварительно собранным SDK.

`NEXT_STANDALONE=1` меняет формат результата: такой сервер запускается через сгенерированный `server.js`,
как в Dockerfile, а не через `web:start`. При смене `distDir` проверяйте изменения `tsconfig.json`,
которые Next.js может автоматически внести для сгенерированных типов маршрутов.

## Сохраняемая инфраструктура API

`src/infra/client-api` использует workspace SDK `@oim/client-rest-api-sdk`:

- browser-клиент предоставляет register/login/logout, чтение и изменение профиля, login и password;
- транспорт использует только Bearer JWT, `credentials: 'omit'`, обработку ошибок и защиту от гонок сессии;
  refresh, cookie-авторизации и автоматического повтора запросов нет;
- серверный клиент сохраняет отдельный transport с `credentials: 'omit'` и пустое дерево операций:
  текущий API не предоставляет публичных GET, независимых от авторизации;
- приватные данные не загружаются в SSR, metadata или RSC payload;
- `src/infra/diagnostics` и его `shared/errors`, а также predicates для проверки credentials сохранены.

API-клиенты не подключены к стартовой странице: она не восстанавливает сессию и не делает auth-запросов.
При будущем подключении изменения login/password учтите: успешная операция отзывает все сессии,
после неё нужен новый вход. Доменный lifecycle должен завершить прежнюю область данных;
сырой transport-вызов сам по себе не заменяет этот сценарий.

### Контракт браузерной сессии

- `loginApiSession` сохраняет JWT в версионированной записи `web-client-session` в `localStorage` текущего origin,
  затем проверяет профиль. Профиль и пароль не сохраняются. Срок вычисляется один раз как минимум `exp` JWT,
  `sessionExpiresAt` и полученного `expiresIn`; стандартный TTL backend — 604800 секунд (7 суток).
- `restoreApiSession` вызывается только из браузерного lifecycle. Она валидирует структуру записи и claims,
  удаляет повреждённый/истёкший credential и проверяет действующий Bearer запросом `GET /users/me`.
  Перезагрузка, активность и повтор проверки не продлевают срок. Старые refresh-cookie/маркеры не восстанавливают сессию:
  после перехода на этот контракт нужен новый вход.
- До успешной проверки нельзя открывать приватный UI. `isReady` обозначает завершение попытки, а не авторизацию:
  `getApiCredential` возвращает проверенный credential/`null` или исходную ошибку bootstrap.
  Сбой сети оставляет приватные операции закрытыми; повторяется явно только проверка профиля, не login/mutation.
  При недоступном storage доступ закрывается; после восстановления доступа к storage нужна перезагрузка страницы.
- Владелец доменного lifecycle подписывается через `subscribeApiSession`, очищает приватный кеш при смене `version`
  и повторяет bootstrap новой сессии. Подписка отслеживает storage/focus/visibility и фиксированный срок,
  её cleanup снимает обработчики и таймер. Перед запросом и принятием ответа scope сверяется также синхронно.
  Поздние ответы прежнего аккаунта отклоняются через `SessionChangedError`.
- Terminal Bearer `401` удаляет только credential соответствующего запроса и передаёт исходную ошибку домену:
  домен закрывает приватный UI и предлагает новый вход. `SessionRequiredError` означает отсутствие действующего credential.
  Ошибка входа не завершает другую сессию. Обновления JWT и retry после `401` нет.
- `logoutApiSession` захватывает текущий Bearer, синхронно очищает credential и публикует новую гостевую ревизию,
  затем вызывает `POST /auth/logout` с захваченным токеном. `401` уже отозванной/истёкшей сессии считается локально
  завершённым выходом. Сетевая ошибка остаётся ошибкой серверного отзыва, но не возвращает приватный UI;
  поздний результат logout не очищает более новый вход. В storage остаётся только гостевая ревизия без JWT.
- `getServerSessionSnapshot` всегда возвращает нейтральное неизвестное состояние. SSR не читает localStorage,
  cookies или credentials; приватные данные не передаются в HTML, RSC, props и начальный клиентский кеш.

JWT в localStorage доступен JavaScript текущего origin: защита от XSS обязательна.
Это технический контракт сохранённой инфраструктуры, не готовый auth-экран или доменный guard.

Настройки — в [.env.example](.env.example); `env.example` — его идентичная копия.
Рабочий `.env.local` повторяет шаблон, отличаться могут только значения.
Next.js читает env из корня приложения с приоритетом: окружение процесса,
`.env.[NODE_ENV].local`, `.env.local`, `.env.[NODE_ENV]`, `.env`.
В режиме test `.env.local` пропускается; режим Next.js выбирает сам.

- `NEXT_PUBLIC_CLIENT_API_URL` — адрес браузерного API; по умолчанию `http://localhost:3001`, фиксируется при build;
- `CLIENT_API_INTERNAL_URL` — отдельный серверный адрес для будущих публичных операций без credentials;
- `NEXT_STANDALONE` — `0` для локального запуска, `1` для standalone-сборки;
- `NEXT_DIST_DIR` — каталог сборки, по умолчанию `.next`.

Client API разрешает CORS всем origin без cookie credentials; `CLIENT_ALLOWED_ORIGINS` и настройка SameSite не нужны.
Bearer передаётся явно в `Authorization`. `localhost` и `127.0.0.1` — разные origin и имеют отдельный localStorage.
Токены и секреты не помещаются в env браузера или серверный SSR-клиент.

## Компоненты

Прикладные TSX создаются через закреплённый `pnpm run create` и
[локальные шаблоны](.templates/README.md). Существующий компонент редактируется без повторной генерации.
Экран сохраняет `props`, отдельные `ScreenParams` / `RootAttrs` / `ScreenProps`, CSS Module и публичный фасет.
