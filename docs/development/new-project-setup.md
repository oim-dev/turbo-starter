# Установка и запуск нового проекта — инструкция для AI-агента

Установи Turbo Starter в новый каталог, настрой окружение, запусти все сервисы
и проверь готовность к разработке. Если пользователь не указал имя проекта
и каталог установки, уточни их. Выполняй команды из корня нового проекта,
кроме первоначального скачивания. В примерах замени `my-project` и путь установки.

## Что внутри шаблона

- `apps/next-web-app` — Next.js 16, React 19 и Mantine: стартовый сайт с серверным рендерингом.
- `apps/react-admin-panel` — React SPA на Vite: пользователи, роли, Keycloak, изображения и файлы с версиями.
- `apps/nest-backend` — NestJS 11, Prisma и PostgreSQL: независимые Client API и Admin API, воркер изображений.
- `packages/` — два типизированных REST SDK, общие конфигурации и инструменты агента.
- `infra/dev/` — PostgreSQL, MinIO, RabbitMQ и imgproxy в Docker Compose.

Монорепозиторий использует TypeScript, pnpm и Turborepo. Приложения запускаются
локальными процессами, инфраструктура — в Docker. Для frontend приняты
Unit Architecture и правила React Reference; инструкции находятся в `AGENTS.md` приложений.

## 1. Подготовь среду

Нужны Node.js 24+, pnpm 11.25.0, Git, Docker Engine и Docker Compose v2+.
Проверь версии и доступ к Docker:

```bash
node --version
pnpm --version
git --version
docker version
docker compose version
docker ps
```

Для установки нужной версии pnpm: `npm install --global pnpm@11.25.0`.
Проверь занятые порты и существующие Compose-проекты (`docker compose ls --all`).
Если стандартные порты заняты, выбери свободные и согласуй их в env-файлах ниже.

## 2. Скачай и подготовь проект

```bash
pnpm dlx tiged@latest oim-dev/turbo-starter#main /путь/к/my-project
cd /путь/к/my-project
git init -b main
```

Tiged скачивает шаблон без истории Git. Задай имя нового проекта в поле `name`
корневого `package.json`. Прочитай его `README.md` и имеющиеся `AGENTS.md`.

```bash
pnpm install
pnpm run setup
```

**`pnpm run setup` обязателен для подготовки к разработке с AI-агентом:**
он восстанавливает скиллы из `skills-lock.json` и запускает сборщик проектных агентов.
После установки прочитай применимые скиллы согласно инструкциям проекта.

## 3. Создай и согласуй env-файлы

В новой копии создай все четыре рабочих файла из примеров:

```bash
cp infra/dev/.env.example infra/dev/.env
cp apps/nest-backend/.env.example apps/nest-backend/.env
cp apps/react-admin-panel/.env.example apps/react-admin-panel/.env.local
cp apps/next-web-app/.env.example apps/next-web-app/.env.local
```

При продолжении прерванной установки сохраняй уже настроенные рабочие файлы.
Меняй значения, сохраняя состав и порядок переменных из примеров.

В `infra/dev/.env` задай собственные имена ресурсов, например:

```dotenv
COMPOSE_PROJECT_NAME=my-project-dev
MINIO_IMAGE=my-project-minio:dev
MINIO_INIT_IMAGE=my-project-minio-init:dev
```

Это выделит новому проекту отдельные контейнеры, сеть, volumes и теги образов.
Остальные значения примеров подходят для локального запуска, если порты свободны.
При изменениях согласуй связанные настройки:

| Настройка | Где согласовать |
| --- | --- |
| PostgreSQL | `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` должны совпадать в `infra/dev/.env` и `apps/nest-backend/.env`; для локального backend `POSTGRES_HOST=localhost` |
| S3 | `S3_PORT` инфраструктуры задаёт порт в `S3_ENDPOINT` backend; `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` совпадают в обоих файлах |
| RabbitMQ | Собери `RABBITMQ_URL` backend из `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_PORT`, `RABBITMQ_VHOST` инфраструктуры |
| imgproxy | Порт `IMGPROXY_URL` backend соответствует `IMGPROXY_PORT`; `IMGPROXY_KEY` и `IMGPROXY_SALT` совпадают в обоих файлах |
| Client API | `CLIENT_API_PORT` backend соответствует URL в `FILE_PUBLIC_BASE_URL`, `IMAGE_PUBLIC_BASE_URL`, а также `NEXT_PUBLIC_CLIENT_API_URL` и `CLIENT_API_INTERNAL_URL` веб-приложения |
| Admin API | `ADMIN_API_PORT` backend соответствует URL в `VITE_BACKEND_URL` админки |
| Сайт и админка | `WEB_PORT` и `VITE_PORT` задают порты интерфейсов; добавь их фактические origin в `S3_CORS_ALLOW_ORIGIN` инфраструктуры |

`S3_INTERNAL_ENDPOINT=http://minio:9000` остаётся внутренним Docker-адресом,
даже если внешний S3-порт изменён. Для браузерной проверки используй `localhost`
либо HTTPS. Убедись, что окружение процесса не подменяет настройки нового проекта.

```bash
pnpm env:check
docker compose -f infra/dev/docker-compose.yml --profile images config --quiet
```

## 4. Запусти инфраструктуру и приложения

Выполняй последовательно, дожидаясь готовности инфраструктуры и успешного применения миграций:

```bash
mkdir -p .artifacts/dev-agents/setup
pnpm infra:dev:images
pnpm backend:prisma:deploy
pnpm dev
```

- `infra:dev:images` собирает MinIO, запускает инфраструктуру, создаёт приватный
  bucket и ожидает healthchecks. Первая сборка может занять несколько минут.
- `backend:prisma:deploy` применяет миграции к БД нового проекта.
- `dev` автоматически подготавливает Prisma Client, оба REST SDK и SVG-спрайт,
  затем запускает сайт, админку, оба API и воркер изображений.

`pnpm dev` — долгоживущий процесс. Запусти его в управляемом терминале или фоне
средствами своей среды, сохрани вывод в `.artifacts/dev-agents/setup/dev.log` и способ остановки.
Дождись готовности обоих интерфейсов, сообщений о запуске API и `Image worker connected`.

Адреса по умолчанию; при изменении портов используй фактические значения:

| Сервис | Адрес |
| --- | --- |
| Сайт / админка | http://localhost:3000 / http://localhost:3001 |
| Client API / Swagger | http://localhost:4000 / http://localhost:4000/docs |
| Admin API / Swagger | http://localhost:4001 / http://localhost:4001/docs |
| MinIO S3 / консоль | http://localhost:9000 / http://localhost:9001 |
| RabbitMQ AMQP / панель | `localhost:5672` / http://localhost:15672 |
| imgproxy / PostgreSQL | http://localhost:18080 / `localhost:5544` |

На новой БД Admin API создаёт владельца `admin/admin`; пароль можно задать
через `BOOTSTRAP_ADMIN_PASSWORD` до первого запуска. Keycloak по умолчанию выключен,
для первоначальной работы используется локальный вход.

## 5. Проверь готовность

```bash
docker compose -f infra/dev/docker-compose.yml --profile images ps -a
pnpm lint
DOTENV_CONFIG_PATH=/dev/null pnpm check-types
pnpm agents:check
```

У PostgreSQL, MinIO, RabbitMQ и imgproxy должен быть статус `healthy`,
у одноразового `minio-init` — `Exited (0)`.

Проверь реальные сценарии:

1. Сайт и админка открываются; оба API отдают `/docs` и `/openapi.json`.
2. В админке работает вход владельца, открываются изображения и файлы.
3. Загрузи небольшое изображение через UI и дождись готовых вариантов — это проверяет
   цепочку браузер → API → MinIO → RabbitMQ → воркер → imgproxy.
4. Загрузи небольшой документ и проверь его публичную ссылку и скачивание.
5. Через Client API проверь регистрацию, вход, чтение профиля и выход.

Для UI используй проектный `agent-browser` в собственной именованной сессии
по инструкции `apps/react-admin-panel/AGENTS.md`. Перед первым запуском браузера
выполни `pnpm --filter @oim/react-admin-panel run browser:install`.
Проверь ошибки браузера и логи приложений, сохрани артефакты и закрой свою браузерную сессию.

## 6. Передай результат пользователю

Оставь сервисы работающими и сообщи:

- каталог нового проекта и фактические адреса сервисов;
- результаты установки, миграций, проверок и пользовательских сценариев;
- обнаруженные проблемы с точными командами и ошибками;
- пути к логам и способ остановки запущенного `pnpm dev`.

Для остановки инфраструктуры из корня проекта используется `pnpm infra:dev:down`;
данные volumes сохраняются.

При ошибке сохрани её причину и продолжай независимые шаги.
Не объявляй подготовку полностью завершённой, если обязательная проверка не прошла.

## 7. Передай разработку в новую сессию

В конце обязательно сообщи пользователю, подставив абсолютный путь установки:

> Перед началом разработки завершите текущую сессию и перезапустите агентский клиент
> из папки установленного проекта: `<абсолютный путь к проекту>`.
> Откройте новую сессию с этой папкой в качестве рабочего каталога,
> чтобы загрузились проектные инструкции и установленные скиллы.

После этого заверши текущую задачу. **Не приступай к разработке проекта в сессии,
запущенной вне папки установленного проекта.** Такая сессия используется только
для установки и проверок по этой инструкции. `cd` в отдельной shell-команде
не заменяет запуск новой сессии из корня проекта.
