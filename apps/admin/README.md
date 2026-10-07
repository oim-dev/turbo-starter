# @biocad/admin

Панель администрирования BIOCAD на React, Vite, Mantine, TanStack Router и React Query.

## Запуск

Команды выполняются из корня монорепозитория:

```bash
pnpm dev:admin
pnpm build:admin
pnpm --filter @biocad/admin lint
pnpm --filter @biocad/admin typecheck
```

## Маршруты

| URL | Назначение |
| --- | --- |
| `/login` | Запуск redirect-based входа через Keycloak BFF. |
| `/` | Защищённый основной каркас панели администрирования. |
| `/publications` | Список и фильтры публикаций. |
| `/publications/new` | Создание публикации. |
| `/publications/:publicationId` | Редактирование публикации. |

Доменный `AuthRoot` разрешает `/api/auth/session` до отображения дочерних маршрутов. Неавторизованный пользователь перенаправляется на `/login` с безопасным `returnTo`; `401` от admin API отзывает локальное auth-состояние.

Vite запускается на `ADMIN_PORT` (`3001` по умолчанию) и проксирует `/api` в `ADMIN_API_PROXY_TARGET` (`http://localhost:4001` по умолчанию). Браузер работает только с same-origin `HttpOnly` cookie и in-memory CSRF token.

## SLM-структура

```text
src/
├── app/             # bootstrap и router
├── compositions/    # routes, layouts, screens и widgets
├── domains/         # предметные сценарии, состояние, интеграция и доменный UI
├── infra/           # app config, theme и технические сервисы
└── shared/          # общие стили, типы и чистые утилиты
```

Направление зависимостей:

```text
app -> compositions | domains | infra | ui | shared
compositions -> compositions | domains | infra | ui | shared
domains -> domains | infra | ui | shared
infra -> infra | ui | shared
ui -> ui | shared
shared -> shared
```

Каждый модуль предоставляет публичный API через объявленные фасеты (`index.ts`, `client.ts` при необходимости). Deep imports во внутренние сегменты модулей запрещены.

Клиентские возможности домена `auth` доступны через `domains/auth/client`. Внутренние context, state, mappers, services и компоненты не образуют самостоятельных модулей и не импортируются снаружи домена.

## Генерация файлов

Шаблоны общие для монорепозитория и находятся в корневой `.templates`. Генератор запускается из корня:

```bash
npx @gromlab/create route users apps/admin/src/compositions/routes
npx @gromlab/create layout users apps/admin/src/compositions/layouts
npx @gromlab/create screen users apps/admin/src/compositions/screens
npx @gromlab/create module filters apps/admin/src/compositions/screens/users/parts
```

Не создавай отдельную `apps/admin/.templates`. Правила выбора шаблона описаны в корневом `.templates/README.md`.

## Стили

- UI собирается из Mantine и Tabler Icons.
- CSS Modules используются только там, где Mantine API недостаточно.
- Custom media объявлены в `src/shared/styles/media.css` и доступны через PostCSS global data.
- Общие CSS variables находятся в `src/shared/styles/variables.css`.
