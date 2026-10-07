# React Admin Panel

`@repo/react-admin-panel` — клиентская React SPA на TypeScript, Vite, Mantine и React Router.
Предоставляет вход, защищённую главную, профиль текущего администратора и выход.
Регистрации, управления другими администраторами и продуктового CRUD нет.

## Локальный запуск

Нужны Node.js 24 и версия pnpm из корневого `packageManager`. Зависимости устанавливаются
из корня монорепозитория. Подготовка PostgreSQL, миграций и seed описана в
[документации backend](../nest-backend/README.md). Хранилище файлов для этих экранов не требуется.

Команды ниже выполняются из корня репозитория. Отключение автоматической проверки установки
предотвращает побочные изменения lockfile при `run`/`exec`, но не устанавливает недостающие зависимости:

```sh
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
pnpm --filter @repo/nest-backend run dev:admin
```

Корневые `admin:dev`, `admin:lint`, `admin:check-types` и `admin:build` запускаются через Turbo
с фильтром `@repo/react-admin-panel` и автоматически собирают SDK через зависимость `^build`.
SDK собирается из уже сгенерированного актуального контракта; генерацию выполняйте по
[инструкции SDK](../../packages/admin-rest-api-sdk/README.md), только после готовности OpenAPI.
В другом терминале запустите SPA:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false VITE_HOST=localhost VITE_PORT=5173 VITE_HTTPS=false VITE_BACKEND_URL=http://127.0.0.1:3002 pnpm run admin:dev
```

Откройте http://localhost:5173. Начальный локальный вход после seed — `admin` / `admin`,
если не переопределён seed-пароль; seed не сбрасывает пароль существующего администратора.
Swagger Admin API: http://localhost:3002/docs.

Настройки документированы в [env.example](env.example). Vite проксирует `/api/` на
`VITE_BACKEND_URL`, удаляя префикс `/api`. Порт фиксирован через `strictPort`.
HTTP включён по умолчанию для loopback; HTTPS включается явно через `VITE_HTTPS=true`
и требует соответствующего origin в allowlist backend. Личный `.env.local` может переопределять
настройки: значения в приведённой команде имеют приоритет. Не помещайте секреты в `VITE_*`.

## Проверка собранного приложения через preview

Сначала остановите dev-сервер. Dev и preview используют один порт **5173** и запускаются
по очереди. Preview раздаёт готовый `dist`, а не исходники и не HMR; команду сборки нужно
выполнить до запуска. Admin API на порту 3002 должен продолжать работать.

Из корня репозитория:

```sh
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
pnpm run admin:build
VITE_HOST=localhost VITE_PORT=5173 VITE_HTTPS=false VITE_BACKEND_URL=http://127.0.0.1:3002 pnpm run admin:preview
```

Откройте http://localhost:5173/profile: без сессии произойдёт переход на вход. Проверьте
вход `admin` / `admin`, профиль, обновление страницы с восстановлением сессии и выход.
Команда `admin:preview` не собирает приложение автоматически.

`server` и `preview` используют одну конфигурацию host/port и proxy: `/api/*` направляется
на `VITE_BACKEND_URL` с удалением `/api`. Стандартный preview-порт Vite 4173 не используется:
origin остаётся в dev allowlist backend без изменения CORS. `strictPort: true` запрещает
незаметный переход на 5174 при занятом 5173. При изменении host, порта или схемы потребуется
согласовать origin с backend; само включение preview разрешения CORS не расширяет.

Vite preview предназначен только для локальной проверки сборки, не для production-поставки.

## Маршруты и авторизация

- `/sign-in` — форма входа; авторизованный пользователь возвращается на безопасный приватный адрес.
- `/` — защищённая главная с sidebar/header.
- `/profile` — read-only профиль текущего администратора.
- Неизвестный URL — страница 404 без продуктовых данных.

`domains/auth` владеет сессией и профилем. Access token хранится только в памяти;
HttpOnly refresh cookie управляется браузером. Восстановление подтверждается запросом `/auth/me`
до показа приватного интерфейса. Выход немедленно закрывает локальный доступ и очищает приватный
кеш; неподтверждённый сервером выход явно сообщается пользователю.

Для координации вкладок нужны Web Locks, BroadcastChannel и localStorage в безопасном контексте:
локальный `http://localhost` либо HTTPS. Используйте один origin во всех вкладках.
Подробнее — [auth](src/domains/auth/README.md) и [API-клиент](src/infra/backend-admin-api/README.md).

## Архитектура и генерация

Работа начинается с [блокирующего протокола](AGENTS.md) и
[профиля React SPA](../../.claude/skills/react-reference/reference/application/architecture/project-profile.md).
`app` подключает публичные API; экраны и каркас находятся в `compositions`, сессия — в `domains/auth`,
технические интеграции — в `infra`, тема — в `ui/themes`.

Новые TSX создаются только из [локальных шаблонов](.templates/README.md), без `--overwrite`.
Запускать из корня приложения:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run create ui-unit example src/compositions/screens
```

## Проверки

Из корня репозитория:

```sh
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
pnpm run admin:lint
pnpm run admin:check-types
pnpm run admin:build
```

Для адресного запуска внутри приложения доступны `lint`, `check-types`, `build` и `dev`;
локальный `typecheck` — совместимый alias `check-types`. Прямой запуск внутри приложения
требует уже собранного SDK. Браузерную проверку выполнять в отдельном процессе
или профиле, не в общей сессии другого приложения: реальный вход, reload/restore, профиль, logout,
ошибки, клавиатура, мобильная навигация и обе темы. Автотестовый стек в приложение не добавляется.

## Поставка

[Dockerfile](Dockerfile) собирает SDK и SPA. Образ nginx раздаёт SPA и сохраняет fallback для
прямых URL. Внешний reverse proxy должен направлять `/api/*` в Admin API с удалением `/api`;
сам nginx приложения API не проксирует. Origin allowlist и cookie-параметры согласуются с адресом
поставки на backend. Docker-сборка требует синхронизированного root lockfile для нового пути приложения.
