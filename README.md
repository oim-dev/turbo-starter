# Turbo Starter

Fullstack-шаблон на **TypeScript, pnpm и Turborepo** для проектов с веб-приложением,
административной панелью и backend. Все приложения, общие пакеты и локальная
инфраструктура входят в комплект.

## Что внутри

| Приложение                                                   | Назначение                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [`apps/next-web-app`](apps/next-web-app/README.md)           | Next.js 16, React 19 и Mantine. Стартовая страница с серверным рендерингом и подготовленная интеграция с Client API. |
| [`apps/react-admin-panel`](apps/react-admin-panel/README.md) | React SPA на Vite и Mantine: пользователи, роли, настройки входа, изображения и файлы.                               |
| [`apps/nest-backend`](apps/nest-backend/README.md)           | NestJS 11, Prisma и PostgreSQL: отдельные Client API и Admin API, воркер обработки изображений.                      |

Готовые возможности:

- Клиентские и административные аккаунты, вход и профиль, роли и права доступа.
  В админке дополнительно поддерживается вход через Keycloak.
- Медиатека: загрузка изображений, поиск, папки, теги, предпросмотр
  и фоновая подготовка размеров и форматов.
- Файлы: загрузка в S3, история версий, выбор текущей версии,
  постоянные ссылки, просмотр и скачивание.
- Два типизированных REST SDK из OpenAPI, общие пакеты конфигураций
  в `packages/`.
- Docker Compose с PostgreSQL, MinIO, RabbitMQ и imgproxy в `infra/dev/`.

Веб-приложение содержит основу для будущего интерфейса; готовые экраны управления
находятся в админке. Keycloak подключается через её настройки.

## Установка

Требуются **Node.js 24+**, **pnpm 11.25.0**, **Git**, **Docker Engine и Docker Compose v2+**.
Установить pnpm можно командой `npm install --global pnpm@11.25.0`.

Скачайте шаблон через [tiged](https://github.com/tiged/tiged#readme),
заменив `my-project` на имя своего проекта:

```bash
pnpm dlx tiged@latest oim-dev/turbo-starter#main my-project
cd my-project
git init -b main
pnpm install
pnpm run setup
```

Tiged копирует весь шаблон без истории Git. Укажите имя проекта в корневом `package.json`.

**`pnpm run setup` — обязательный шаг перед разработкой с AI-агентом.** Команда
восстанавливает проектные скиллы из `skills-lock.json`, затем запускает сборщик
проектных агентов (`agents:build`). Скиллы исключены из Git и не устанавливаются
командой `pnpm install`. После подготовки перезапустите агентский клиент и начните
новую сессию. Подробности — в [инструкции по скиллам](docs/development/skills.md).

Используйте именно `pnpm run setup`: `pnpm setup` — встроенная команда настройки
самого pnpm, а не запуск проектного скрипта.

## Локальный запуск

Все команды выполняются из корня нового проекта:

```bash
pnpm infra:dev:images
pnpm backend:prisma:deploy
pnpm dev
```

Первая команда поднимает PostgreSQL, MinIO, RabbitMQ и imgproxy, вторая применяет
миграции к БД. `pnpm dev` запускает сайт, админку, оба API и воркер изображений.
Prisma Client и REST SDK подготавливаются автоматически.

Приложения работают локальными процессами, инфраструктура — в Docker.
При первом запуске собирается образ MinIO, поэтому подготовка может занять несколько минут.

### Интерфейсы и сервисы

Адреса по умолчанию после запуска:

| Сервис                                              | Адрес                        |
| --------------------------------------------------- | ---------------------------- |
| Веб-приложение                                      | <http://localhost:3000>      |
| Админка                                             | <http://localhost:3001>      |
| Client API                                          | <http://localhost:4000>      |
| Swagger Client API                                  | <http://localhost:4000/docs> |
| Admin API                                           | <http://localhost:4001>      |
| Swagger Admin API                                   | <http://localhost:4001/docs> |
| Консоль MinIO — управление S3-хранилищем            | <http://localhost:9001>      |
| S3 API MinIO                                        | <http://localhost:9000>      |
| Панель RabbitMQ                                     | <http://localhost:15672>     |
| RabbitMQ — AMQP                                     | `localhost:5672`             |
| imgproxy — служебный HTTP для обработки изображений | <http://localhost:18080>     |
| PostgreSQL                                          | `localhost:5544`             |

Данные для локальной разработки:

- **Админка:** `admin` / `admin`. Владелец создаётся при первом запуске Admin API,
  если административных аккаунтов ещё нет.
- **MinIO:** `user` / `password`, bucket `default-bucket`.
- **RabbitMQ:** `image` / `image-password`.
- **PostgreSQL:** `user` / `password`, база `default-db`.

Для остановки приложений нажмите `Ctrl+C`, затем выполните `pnpm infra:dev:down`.
Данные Docker volumes сохраняются.

## Настройки окружения

Для стандартного локального запуска достаточно встроенных значений.
Чтобы изменить настройки, скопируйте соответствующий пример в рабочий файл
в том же каталоге и измените значения:

| Пример                                                                       | Рабочий файл |
| ---------------------------------------------------------------------------- | ------------ |
| [`apps/nest-backend/.env.example`](apps/nest-backend/.env.example)           | `.env`       |
| [`apps/react-admin-panel/.env.example`](apps/react-admin-panel/.env.example) | `.env.local` |
| [`apps/next-web-app/.env.example`](apps/next-web-app/.env.example)           | `.env.local` |
| [`infra/dev/.env.example`](infra/dev/.env.example)                           | `.env`       |

Рабочие env-файлы исключены из Git. Их структуру проверяет `pnpm env:check`:
состав и порядок переменных должны совпадать с примером, отличаться могут значения.

## Основные команды

| Команда                      | Назначение                                     |
| ---------------------------- | ---------------------------------------------- |
| `pnpm run setup`             | Подготовить проектные скиллы и инструменты AI-агента |
| `pnpm web:dev`               | Запустить только веб-приложение                |
| `pnpm admin:dev`             | Запустить только админку                       |
| `pnpm backend:dev`           | Запустить оба API и воркер                     |
| `pnpm build`                 | Собрать приложения и пакеты                    |
| `pnpm lint`                  | Проверить env-файлы и код                      |
| `pnpm check-types`           | Проверить типы                                 |
| `pnpm rest-api-sdk:generate` | Обновить OpenAPI и оба SDK после изменения API |
| `pnpm infra:dev:logs`        | Смотреть логи инфраструктуры                   |

Подробности запуска и разработки — в README [backend](apps/nest-backend/README.md),
[админки](apps/react-admin-panel/README.md), [веб-приложения](apps/next-web-app/README.md)
и [инфраструктуры](infra/dev/README.md).

## Параллельная работа в worktree

Для отдельной задачи создайте окружение и запустите его:

```bash
pnpm worktree:create task-123
pnpm worktree:up task-123
```

Worktree размещается в `~/worktrees/<хост>/<владелец>/<репозиторий>/task-123`.
Порты, четыре env-файла и Docker-ресурсы изолированы. Адреса показывает
`pnpm worktree:status task-123`. Удаление вместе с Docker volumes и рабочими
артефактами: `pnpm worktree:remove task-123`.

Требования, остановка и порядок удаления описаны в [инструкции](docs/development/worktrees.md).
