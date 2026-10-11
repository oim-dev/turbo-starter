# React Admin Panel

`@oim/react-admin-panel` — админка на React, TypeScript, Vite и Mantine.
Вход, личный профиль и управление пользователями, ролями и Keycloak по правам доступа.
Панель управления открывается из меню пользователя.

## Локальный запуск

Нужны Node.js 24+, pnpm из корневого `packageManager` и PostgreSQL с применёнными
миграциями — см. [настройку backend](../nest-backend/README.md).

Из корня репозитория:

```sh
pnpm install
pnpm --filter @oim/nest-backend run dev:admin
```

В другом терминале, также из корня:

```sh
pnpm run admin:dev
```

- Админка: http://localhost:3001.
- Swagger Admin API: http://localhost:4001/docs.
- На пустой БД создаётся владелец `admin` / `admin`; повторный запуск не сбрасывает пароль.
- Настройки: [.env.example](.env.example), локальные значения — в `.env.local`.
  По умолчанию `/api/*` проксируется в `http://127.0.0.1:4001` с удалением `/api`.
- Для авторизации используйте `localhost` либо HTTPS.

## Проверки и сборка

Из корня репозитория:

```sh
pnpm run admin:lint
pnpm run admin:check-types
pnpm run admin:build
pnpm run admin:preview
```

Команды `admin:dev`, `admin:lint`, `admin:check-types` и `admin:build` собирают необходимый SDK.
`preview` запускается после сборки,
использует тот же порт 3001 и требует работающего Admin API; перед ним остановите dev-сервер.

## Браузерный инструмент

`agent-browser` установлен в приложении. Конфигурация — [agent-browser.json](agent-browser.json),
правила проверки — [AGENTS.md](AGENTS.md#проверка-через-agent-browser).
Команды выполняются из `apps/react-admin-panel`:

```sh
pnpm run browser:install
SESSION="admin-check-$(date +%s)-$$"
pnpm run browser --session "$SESSION" open http://localhost:3001
pnpm run browser --session "$SESSION" snapshot -i
pnpm run browser --session "$SESSION" close
```

`browser:install` однократно скачивает Chrome в кеш машины; на Linux при нехватке
системных библиотек добавьте `--with-deps`. Для каждой задачи используйте уникальную сессию.
Скриншоты сохраняйте в корневом `.artifacts/react-admin-panel/<имя-сессии>/` — каталог исключён из Git.

## Разработка

- [AGENTS.md](AGENTS.md) — архитектура и правила работы.
- [Шаблоны](.templates/README.md) — создание новых TSX через генератор.
- [Авторизация](src/domains/auth/README.md) — сессии, выход и координация вкладок.
- [REST SDK](../../packages/admin-rest-api-sdk/README.md) — API-клиент и генерация.
- [Keycloak](../nest-backend/docs/admin-keycloak.md) — настройка корпоративного входа.

### Проектные SVG

Исходники находятся в `src/shared/svg`. Спрайт собирается через `@gromlab/svg-sprites@2.1.0`
в режиме `react@vite` по явному списку файлов в
[`svg-sprite.config.json`](src/infra/app-icons/svg-sprite.config.json).
Компоненты импортируют `AppIcon` через публичный фасет `infra/app-icons`.

`pnpm run sprites` из каталога приложения пересобирает спрайт. Генерация также встроена
в `dev`, `build` и `check-types`. Каталог `.svg-sprite` создаётся генератором и исключён из Git.

Логотип BIOCAD использует `icon="biocad-logo"`. Его размеры задаются классом `brandLogo`
в `admin-sidebar.module.css`; пропорции сохраняются и в компактном меню. Генератор заменяет
исходный цвет на `var(--icon-color-1, currentColor)`, а ссылка логотипа наследует цвет
текущей темы через `--app-color-text-strong`. Переходы цветов спрайта отключены в конфигурации.

## Поставка

[Dockerfile](Dockerfile) собирает SDK и SPA; nginx раздаёт приложение с fallback для маршрутов.
Внешний reverse proxy должен направлять `/api/*` в Admin API с удалением префикса `/api`.
