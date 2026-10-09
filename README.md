# OIM

Универсальная основа проекта на **Turborepo** и **pnpm**: общие пакеты,
сборщик AI-агентов, проектные скиллы и Relay для хранения знаний и задач.
Базовые приложения: NestJS backend с клиентским и административным API,
React-админка и Next.js со стартовой страницей.

Корневой пакет — `@oim/oim`; все приложения и общие пакеты используют scope `@oim`.

## Требования

- **Node.js 24+** и входящий в его поставку `npm`/`npx`.
- **pnpm 11.25.0** — версия закреплена в `package.json`.
- **Git**.
- **Docker Engine и Docker Compose v2+** для локальной PostgreSQL.
- Доступ к GitHub и npm registry для скачивания шаблона, зависимостей и скиллов.

Если pnpm ещё не установлен:

```bash
npm install --global pnpm@11.25.0
```

Проверить окружение:

```bash
node --version
pnpm --version
git --version
```

## Быстрый старт

Скачайте шаблон через [tiged](https://github.com/tiged/tiged#readme)
в новый каталог. Замените `my-project` на имя своего каталога:

```bash
pnpm dlx tiged@latest oim-dev/turbo-starter#main my-project
cd my-project
pnpm install
pnpm run setup
```

Глобальная установка tiged не требуется. Он скачивает файлы шаблона без истории Git
и применяет действия из корневого `degit.json`.

`pnpm install` устанавливает зависимости всех workspace-пакетов.
`pnpm run setup` последовательно:

1. Восстанавливает скиллы из `skills-lock.json` в `.agents/skills/`.
2. Собирает профили агентов и конфигурации OpenCode, Claude Code и Codex.

После подготовки откройте проект в выбранном агентском клиенте. Если клиент уже
был запущен, перезапустите его, чтобы он загрузил скиллы и профили.

Для собственного репозитория инициализируйте Git:

```bash
git init -b main
```

Укажите имя нового проекта в корневом `package.json`, добавьте нужные приложения
в `apps/` и адаптируйте инструкции агентов под их структуру.

### Локальный backend

```bash
pnpm infra:dev:up
pnpm backend:prisma:generate
pnpm backend:prisma:deploy
pnpm backend:dev
```

Client API: <http://localhost:3001/docs>, Admin API: <http://localhost:3002/docs>.
Начальный владелец `admin/admin` создаётся автоматически при запуске Admin API на пустой БД. Регистрация доступна
только клиентам. Оба API имеют независимые токены и сессии.
JWT возвращается в JSON и передаётся через Bearer; JWT и сессия действуют 7 дней,
без refresh и основных auth-cookies. Logout отзывает текущую сессию по Bearer JWT.
CORS разрешает любой origin без allowlist; временные cookies остаются только для Admin OIDC.

Значения по умолчанию описаны в [инфраструктуре разработки](infra/dev/README.md).
При наличии перенесённых `.env` согласуйте их структуру с текущими `.env.example` перед запуском.
Подробнее: [backend](apps/nest-backend/README.md).

### Интерфейсы

В отдельных терминалах:

```bash
pnpm admin:dev
pnpm web:dev
```

- Админка: <http://localhost:5173>, вход `admin/admin` через Admin API.
- Next.js: <http://localhost:3005>, автономная стартовая страница.

Для одновременного запуска всех приложений после подготовки БД используйте
`pnpm dev`. Turborepo предварительно собирает workspace-зависимости приложений,
включая SDK. Их транспорт, сессии и конфигурация сохранены в `src/infra` приложений;
списки операций соответствуют очищенным API.

## Переменные окружения

Все env-файлы используют единый формат: трёхстрочные заголовки блоков с разделителем
`# ==================================`, сразу под ними — заполненные `KEY=value`,
между блоками — одна пустая строка. Пояснения хранятся в README, примеры — без закомментированных переменных.

| Каталог | Канонический шаблон | Рабочий файл |
| --- | --- | --- |
| `apps/nest-backend` | `.env.example` | `.env` |
| `apps/react-admin-panel` | `.env.example` | `.env.local` |
| `apps/next-web-app` | `.env.example` | `.env.local` |
| `infra/dev` | `.env.example` | `.env` |

`env.example` в каждом каталоге — идентичная копия `.env.example` для совместимости ссылок.
Для стандартного локального запуска используйте полные копии примеров с их dev-значениями:
дополнительная настройка значений не требуется.
Рабочий файл повторяет заголовки, отступы, порядок и набор переменных своего шаблона;
отличаться могут только значения. При обновлении шаблона сохраняйте существующие рабочие
значения и добавляйте новые параметры в те же блоки. Рабочие env-файлы исключены из Git.

`pnpm run env:check` проверяет все env-файлы исходников, включая игнорируемые рабочие файлы,
не выводя значения переменных. Проверка также запускается перед корневым `lint`.
Отсутствие рабочих файлов в свежем checkout допустимо: создавайте их из соответствующего примера.

## Структура

```text
apps/
  nest-backend/             # NestJS: Client API и Admin API
  react-admin-panel/        # React SPA: вход и базовая административная оболочка
  next-web-app/             # Next.js: автономная стартовая страница
packages/
  client-rest-api-sdk/       # Контракт и клиент Client API
  admin-rest-api-sdk/        # Контракт и клиент Admin API
  dev-agents/               # Исходники ролей, сценарии и сборщик агентов
  eslint-config/            # Общие конфигурации ESLint
  typescript-config/        # Общие конфигурации TypeScript
  ui/                       # Базовые React-компоненты
infra/dev/                  # PostgreSQL и необязательный профиль MinIO
infra/prod/                 # Перенесённая production-конфигурация
docs/development/           # Инструкции для разработчиков
.relay/                     # Конфигурация и хранилище Relay
degit.json                  # Действия tiged при создании проекта
skills-lock.json            # Источники проектных скиллов
pnpm-workspace.yaml         # Workspace: apps/* и packages/*
turbo.json                  # Задачи Turborepo
```

После добавления workspace-пакетов выполните `pnpm install`.

## Команды

Все команды выполняются из корня проекта.

| Команда                         | Назначение                                           |
| ------------------------------- | ---------------------------------------------------- |
| `pnpm install`                  | Установить зависимости workspace                     |
| `pnpm run setup`                | Установить скиллы и собрать агентов                  |
| `pnpm dev`                      | Запустить задачи разработки приложений и пакетов     |
| `pnpm build`                    | Выполнить задачи сборки, включая сборку агентов      |
| `pnpm lint`                     | Запустить ESLint в пакетах, где есть скрипт `lint`   |
| `pnpm check-types`              | Проверить типы в пакетах с соответствующим скриптом  |
| `pnpm format`                   | Отформатировать файлы TypeScript, TSX и Markdown     |
| `pnpm env:check`                | Проверить формат примеров и соответствие рабочих env |
| `pnpm agents:build`             | Пересобрать только профили и конфигурации агентов    |
| `pnpm agents:check`             | Проверить актуальность профилей и локальные ссылки   |
| `pnpm infra:dev:up`             | Запустить локальную PostgreSQL                       |
| `pnpm infra:dev:down`           | Остановить dev-инфраструктуру с сохранением volumes  |
| `pnpm backend:dev`              | Запустить оба API в режиме разработки                |
| `pnpm backend:dev:client`       | Запустить только Client API                          |
| `pnpm backend:dev:admin`        | Запустить только Admin API                           |
| `pnpm backend:lint`             | Проверить код backend                                |
| `pnpm backend:check-types`      | Сгенерировать Prisma Client и проверить типы backend |
| `pnpm backend:build`            | Собрать обе серверные точки входа                    |
| `pnpm rest-api-sdk:generate`    | Экспортировать OpenAPI и перегенерировать оба SDK    |
| `pnpm rest-api-sdk:build`       | Собрать оба SDK                                      |
| `pnpm rest-api-sdk:check-types` | Проверить типы обоих SDK                             |
| `pnpm admin:dev`                | Запустить React-админку и собрать её SDK             |
| `pnpm admin:lint`               | Проверить код админки                                |
| `pnpm admin:check-types`        | Проверить типы админки                               |
| `pnpm admin:build`              | Собрать админку вместе с зависимостями               |
| `pnpm web:dev`                  | Запустить Next.js и собрать его SDK                  |
| `pnpm web:lint`                 | Проверить код Next.js-приложения                     |
| `pnpm web:check-types`          | Проверить типы Next.js-приложения                    |
| `pnpm web:build`                | Собрать Next.js вместе с зависимостями               |
| `pnpm web:start`                | Запустить собранное Next.js-приложение               |

Turborepo запускает задачи, определённые в `package.json` отдельных пакетов.
Для работы с одним приложением используйте фильтр по имени его пакета:

```bash
pnpm dev --filter=<имя-пакета>
pnpm build --filter=<имя-пакета>
```

## Агенты и скиллы

Сборщик создаёт пять ролей: `orchestrator-agent`, `engineering-agent`,
`frontend-agent`, `research-agent` и `qa-agent`.
Главная роль — `orchestrator-agent`.

Исходники находятся в `packages/dev-agents/`. Генерируемые профили в
`.opencode/agents/`, `.claude/agents/`, `.codex/agents/`, конфигурации
`opencode.json`, `.claude/settings.json`, `.codex/config.toml` и
`agents-lock.json` исключены из Git и создаются локально командой `pnpm run setup`.
Изменяйте исходники, затем выполняйте `pnpm agents:build`.

Проектные скиллы:

- `react-reference`;
- `relay`;
- `rest-api-codegen-ru`;
- `svg-sprites-ru`;
- `template-generation`;
- `unit-architecture`.

В Git хранится `skills-lock.json`, а установленные каталоги скиллов игнорируются.
В текущем lock-файле не закреплены SHA коммитов источников: восстановление загружает
актуальное содержимое их веток по умолчанию. Правила закрепления и обновления версий
описаны в [инструкции по скиллам](docs/development/skills.md).

Подробнее о ролях и генерации — в [README пакета агентов](packages/dev-agents/README.md).

### Проверка профилей агентов

`pnpm run setup` собирает профили, но не запускает `agents:check`.
При адаптации профилей сверяйте ссылки с фактическими приложениями и их локальными
`AGENTS.md`/`README.md`. Источники ролей, документация и проверка
`packages/dev-agents/scripts/links.mjs` должны описывать один состав проекта.

После адаптации порядок проверки, в том числе в CI:

```bash
pnpm install --frozen-lockfile
pnpm run setup
pnpm agents:check
```

## Relay

Relay хранит знания о проекте, документы, задачи и планы в `.relay/`.
`pnpm run setup` не запускает Relay Server.

Проверить подключение и состояние:

```bash
npx @oim-dev/relay-cli config get
npx @oim-dev/relay-cli project get
npx @oim-dev/relay-cli product overview
```

Запустить веб-интерфейс в отдельном терминале из корня проекта:

```bash
npx @oim-dev/relay-server --open
```

По умолчанию интерфейс доступен по адресу <http://127.0.0.1:4700/>.
Ориентируйтесь на адрес, напечатанный сервером. Он работает, пока запущен процесс;
для остановки нажмите `Ctrl+C`.

Настройки адреса и порта доступны в справке установленной версии:

```bash
npx @oim-dev/relay-server --help
```

Если вы начинаете проект без каталога `.relay/`, сначала создайте хранилище:

```bash
npx @oim-dev/relay-cli init
```

## Очистка шаблона через tiged

Корневой [`degit.json`](degit.json) — заготовка для удаления демонстрационных
приложений при создании нового проекта:

```json
[
  {
    "action": "remove",
    "files": ["apps/web", "apps/api"]
  }
]
```

Tiged выполняет эти действия в скачанной копии. Если в репозитории шаблона позже
появятся `apps/web` и `apps/api`, они будут удалены из создаваемого проекта.
Другие каталоги `apps/` этим списком не затрагиваются. Сейчас указанных приложений
в шаблоне нет; файл сохранён для будущего использования.

Действия `degit.json` выполняются при скачивании через tiged, а не при `pnpm install`
или `pnpm run setup`.
