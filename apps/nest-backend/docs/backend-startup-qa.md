# Удаление служебного CLI и пересоздание БД — 2026-10-09

## Изменения

- Удалён `src/cli`, команды admin:create/admin:identity/sessions:cleanup/prisma:seed,
  корневой alias seed и ссылка seed в Prisma config.
- Удалены одноразовые bootstrap-admin/catalog-seed из production Compose/deploy.
- AdminBootstrapService создаёт admin/admin с OWNER при запуске Admin API на пустой
  таблице аккаунтов. Запуск на непустой таблице не меняет логин, пароль и роли.
- SessionCleanupService удаляет истёкшие записи при запуске и раз в минуту;
  каждый API обслуживает только свой контур.
- OWNER управляет привязками Keycloak, локальным паролем и отзывом сессий через
  существующий `/access` и защищённые API. Контракт списка аккаунтов содержит активные identities.

## Выполненные операции с инфраструктурой

По прямому разрешению пользователя удалены контейнер
`turbo-starter-backend-check-postgres-1` и его volume
`turbo-starter-backend-check_postgres_dev_data`. Они пересозданы из `infra/dev/docker-compose.yml`
с прежним Compose project и портом `127.0.0.1:5545`. База/пользователь — starter,
credentials разработки — из env.example. Пользовательские env-файлы не читались и не менялись.

К новой базе starter применены 21 миграция; Prisma migrate diff не выявил расхождений.
При запуске Admin API автоматически создан единственный начальный OWNER admin/admin.
Успешные login/logout проверены. Локальные API вновь запущены из сборки на 3001 и 3002;
proxy админки на 5173 возвращает providers 200. Клиентские аккаунты из прежней БД удалены.

## Проверки

Дополнительные сценарии выполнялись в отдельной временной базе starter_cli_check,
не в пересозданной рабочей starter:

- Повторный запуск после переименования владельца: admin больше не создаётся,
  прежний admin login — 401, переименованный владелец входит прежним паролем (200).
- OWNER bind/unbind — 204; пользователь без системных прав получает 403.
- Bind отзывает ранее открытый JWT целевого аккаунта (401).
- Identity нельзя привязать другому аккаунту, даже после её отзыва (409).
- Отключение локального пароля — 204 при наличии identity, local login после этого — 401.
- У активного аккаунта нельзя удалить последний способ входа (400).
- Неактивный аккаунт допускает отзыв последней identity; его повторная активация без
  способа входа запрещена (400). Отзыв всех сессий доступен OWNER (204).
- Admin API при запуске удалил истёкшие AdminSession/OIDC transaction/completion,
  сохранил used refresh token действующей сессии и не тронул клиентскую сессию.
- Client API затем удалил истёкшую ClientSession и сохранил действующую AdminSession.
- В отдельном процессе Chromium: привязка/отзыв/повторная привязка, отключение local,
  завершение сессий и reload прошли через UI. Page errors нет, на ширине 390px overflow нет.
- Backend lint/check-types/build, Admin SDK generate/check-types/build, SPA lint/build
  с TypeScript прошли. Client OpenAPI не изменён. git diff --check чистый.
- bash -n для production scripts и docker compose config --quiet с несекретными
  проверочными значениями прошли; production deployment не выполнялся.

Изолированные процессы проверки остановлены, starter_cli_check удалена.
Основной контейнер PostgreSQL оставлен работающим и healthy.
Vite сообщает о основном JS chunk около 689 kB; сборка успешна.
Настоящий Keycloak в этой поправке повторно не запускался: OIDC flow не менялся,
его предыдущая приёмка описана в admin-access-qa.md.

Новый TSX создан через
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run create ui-component account-security src/compositions/screens/access/ui/accounts-panel/ui`
из apps/react-admin-panel. Итоговый путь:
`src/compositions/screens/access/ui/accounts-panel/ui/account-security/account-security.tsx`.

## Исправление адреса PostgreSQL после проверки пользовательского запуска

Проверочный порт 5545 не совпадал со штатным localhost:5544 в конфигурации backend.
На localhost:5544 до исправления воспроизведён AggregateError с ECONNREFUSED.
Контейнер пересоздан с публикацией `127.0.0.1:5544`, прежний volume сохранён без очистки.
Это актуальный порт БД; указание 5545 выше относится к первоначальной операции.

Добавлена диагностика startup: известный код вложенной ошибки и hostname/port БД,
без полного DATABASE_URL, credentials и исходного текста сторонних исключений.
После исправления AdminBootstrapService и запуск Nest HTTP прошли; /auth/providers — 200.
Отрицательная проверка на теперь свободном 5545 выводит ECONNREFUSED и адрес подключения.
Lint, check-types и обе сборки backend прошли. Проверочный HTTP-сервер использовал
случайный свободный порт и закрыт после проверки; постоянные процессы на 3001/3002
для этой проверки не запускались.
