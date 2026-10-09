# React Admin Panel

`@oim/react-admin-panel` — клиентская React SPA на TypeScript, Vite, Mantine и React Router.
Предоставляет вход, профиль с изменением имени/логина/пароля и выход.
OWNER управляет аккаунтами, дополнительными ролями, permissions и настройками Keycloak.

## Локальный запуск

Нужны Node.js 24 и версия pnpm из корневого `packageManager`. Зависимости устанавливаются
из корня монорепозитория. Подготовка PostgreSQL и миграций описана в
[документации backend](../nest-backend/README.md). Хранилище файлов для этих экранов не требуется.

Команды ниже выполняются из корня репозитория. Отключение автоматической проверки установки
предотвращает побочные изменения lockfile при `run`/`exec`, но не устанавливает недостающие зависимости:

```sh
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
pnpm --filter @oim/nest-backend run dev:admin
```

Корневые `admin:dev`, `admin:lint`, `admin:check-types` и `admin:build` запускаются через Turbo
с фильтром `@oim/react-admin-panel` и автоматически собирают SDK через зависимость `^build`.
SDK собирается из уже сгенерированного актуального контракта; генерацию выполняйте по
[инструкции SDK](../../packages/admin-rest-api-sdk/README.md), только после готовности OpenAPI.
В другом терминале запустите SPA:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false VITE_HOST=localhost VITE_PORT=5173 VITE_HTTPS=false VITE_BACKEND_URL=http://127.0.0.1:3002 pnpm run admin:dev
```

Откройте http://localhost:5173. При запуске Admin API на пустой БД автоматически
создаётся `admin` / `admin`, если начальный пароль не переопределён. Повторный запуск
не сбрасывает пароль и не восстанавливает переименованного администратора.
Swagger Admin API: http://localhost:3002/docs.

Настройки заданы в [.env.example](.env.example); `env.example` — его идентичная копия.
Рабочий `.env.local` повторяет шаблон, отличаться могут только значения.
Vite читает настройки с приоритетом: окружение процесса, `.env.[mode].local`,
`.env.[mode]`, `.env.local`, `.env`. После изменения перезапустите Vite.
Vite проксирует `/api/` на
`VITE_BACKEND_URL`, удаляя префикс `/api`. Порт фиксирован через `strictPort`.
HTTP включён по умолчанию для loopback; HTTPS включается явно через `VITE_HTTPS=true`.
Backend разрешает CORS для любого origin, включая credentialed OIDC-запросы. Личный `.env.local` может переопределять
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
origin остаётся одинаковым для dev/preview. `strictPort: true` запрещает
незаметный переход на 5174 при занятом 5173. При изменении host, порта или схемы проверьте
Keycloak callbacks и cookie-параметры одноразового OIDC flow; CORS allowlist не требуется.

Vite preview предназначен только для локальной проверки сборки, не для production-поставки.

## Маршруты и авторизация

- `/sign-in` — форма входа; авторизованный пользователь возвращается на безопасный приватный адрес.
- `/auth/keycloak/callback` — публичное завершение входа через Keycloak, вне guest/authenticated gating.
- `/` — защищённая главная с sidebar/header.
- `/profile` — профиль и доступные действия над собственным аккаунтом.
- `/access` — управление аккаунтами и ролями, только OWNER.
- `/settings/keycloak` — настройки провайдера и запись secret, только OWNER.
- Неизвестный URL — страница 404 без продуктовых данных.

`domains/auth` владеет сессией и профилем. Основной JWT действует **7 дней без продления**;
refresh token, auth cookies и `/auth/refresh` отсутствуют. Технический `infra/backend-admin-api`
сохраняет JWT в versioned localStorage, изолированном по публичному base URL, не в Zustand persist.
Bootstrap проверяет формат/срок сохранённого JWT и подтверждает `/auth/me` до показа приватного UI.
Повреждённый или истёкший credential удаляется; сетевой сбой сохраняет его для повторной проверки.
Terminal `401` или expiry требуют нового входа. Выход захватывает Bearer до локальной очистки,
закрывает доступ и приватный кеш, затем отзывает именно эту сессию через `POST /auth/logout`.
`401` выхода означает уже завершённую сессию; неполученное подтверждение при сбое сети сообщается явно.
LocalStorage доступен JavaScript страницы: такая модель требует защиты от XSS; JWT нельзя логировать.

Для координации вкладок нужны Web Locks, BroadcastChannel и localStorage в безопасном контексте:
локальный `http://localhost` либо HTTPS. Используйте один origin во всех вкладках.
Подробнее — [auth](src/domains/auth/README.md) и [API-клиент](src/infra/backend-admin-api/README.md).

### Локальный вход и Keycloak

Форма логина/пароля остаётся доступной независимо от загрузки `GET /api/auth/providers`.
Кнопка **«Войти через Keycloak»** появляется только при `keycloak: true`; при ошибке списка
методов показывается отдельное сообщение и повтор GET без очистки локального ввода.
Переход на `/api/auth/keycloak/login?returnTo=…` — обычная browser navigation, не запрос `fetch`.
Настройки Keycloak хранятся в БД. OWNER вводит новый secret в форме настройки;
сохранённый secret никогда не возвращается в SPA и не хранится в browser storage.

Callback принимает только публичный результат, а не токены или authorization code. При успехе
домен однократно вызывает `POST /api/auth/keycloak/complete` через общий клиент с CSRF header
и HttpOnly completion cookie. После `/auth/me` пользователь возвращается на проверенный
приватный маршрут. Обычный bootstrap на callback приостановлен; StrictMode и смена приватного
кеша не повторяют completion. Использованный, истёкший или потерянный результат требует
нового входа, а не автоматического повтора изменяющего запроса.

`hasLocalPassword: false` сопровождается пояснением, что пароль управляется корпоративной
системой; форма локального пароля скрыта. Имя и логин доступны по permissions.
Смена логина/пароля отзывает все сессии и возвращает пользователя на вход.
Выход завершает только административную сессию. Он не вызывает Keycloak end-session и не
обещает немедленного завершения глобальной SSO-сессии. Допуск, привязка аккаунта, роли и TTL
проверяются backend, а не воспроизводятся в интерфейсе.

## Архитектура и генерация

Работа начинается с [блокирующего протокола](AGENTS.md) и
[профиля React SPA](../../.claude/skills/react-reference/reference/application/architecture/project-profile.md).
`app` подключает публичные API; экраны и каркас находятся в `compositions`, сессия — в `domains/auth`,
технические интеграции — в `infra`, тема — в `ui/themes`.

`domains/admin-access` владеет ролями, аккаунтами и синхронизацией их SWR-кеша;
`domains/keycloak-settings` — безопасной моделью конфигурации провайдера.
Новые permissions добавляются вместе с серверными действиями; OWNER выбирает их
из каталога при создании роли. Встроенные OWNER/ADMIN/USER неизменяемы.
Системные права не делегируются дополнительным ролям. UI не заменяет серверный guard.

Смена конфигурации Keycloak отменяет pending flows и отзывает прежние SSO-сессии.
Все настройки Keycloak, включая client secret, хранятся в БД и вводятся в интерфейсе;
env-переменных провайдера нет. Срок административной сессии фиксирован: 7 дней для локального и Keycloak-входа;
он не редактируется. TTL одноразовых transaction/completion не является TTL сессии.
Связывание пользователя Keycloak с аккаунтом по issuer/sub,
отзыв привязок, отключение локального пароля и завершение сессий находятся в `/access`
у выбранного аккаунта. CLI backend удалён; автоматической регистрации через KC нет.

Новые TSX создаются только из [локальных шаблонов](.templates/README.md), без `--overwrite`.
Запускать из корня приложения:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run create ui-unit example src/compositions/screens
```

## Проверки

### Генерация новых TSX для ролей и настроек

Фактически выполненные команды из корня приложения (каждая с
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`), без `--overwrite`:

| Команда | Итоговый файл относительно src/ |
| --- | --- |
| `pnpm run create ui-unit access src/compositions/screens` | `compositions/screens/access/access.screen.tsx` |
| `pnpm run create ui-unit keycloak-settings src/compositions/screens` | `compositions/screens/keycloak-settings/keycloak-settings.screen.tsx` |
| `pnpm run create ui-unit permission src/compositions/route-boundaries` | `compositions/route-boundaries/permission/permission.boundary.tsx` |
| `pnpm run create ui-unit roles-panel src/compositions/screens/access/ui` | `compositions/screens/access/ui/roles-panel/roles-panel.tsx` |
| `pnpm run create ui-unit accounts-panel src/compositions/screens/access/ui` | `compositions/screens/access/ui/accounts-panel/accounts-panel.tsx` |
| `pnpm run create ui-component role-editor src/compositions/screens/access/ui/roles-panel/ui` | `compositions/screens/access/ui/roles-panel/ui/role-editor/role-editor.tsx` |
| `pnpm run create ui-component account-editor src/compositions/screens/access/ui/accounts-panel/ui` | `compositions/screens/access/ui/accounts-panel/ui/account-editor/account-editor.tsx` |
| `pnpm run create ui-component keycloak-form src/compositions/screens/keycloak-settings/ui` | `compositions/screens/keycloak-settings/ui/keycloak-form/keycloak-form.tsx` |
| `pnpm run create ui-component profile-settings src/compositions/screens/profile/ui` | `compositions/screens/profile/ui/profile-settings/profile-settings.tsx` |
| `pnpm run create ui-component account-security src/compositions/screens/access/ui/accounts-panel/ui` | `compositions/screens/access/ui/accounts-panel/ui/account-security/account-security.tsx` |

Каркасы адаптированы к контрактам, неиспользуемые шаблонные стили и props удалены.
Результаты HTTP и изолированной браузерной приёмки:
[admin-access-qa.md](../nest-backend/docs/admin-access-qa.md).

### Команды

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
сам nginx приложения API не проксирует. Backend разрешает preflight для `Authorization`,
`Content-Type` и `X-CSRF-Protection`; для `credentials: include` он отражает Origin, а не возвращает `*`.
Cookie-параметры и callbacks одноразового Keycloak flow согласуются с адресом поставки.
Docker-сборка требует синхронизированного root lockfile для нового пути приложения.
