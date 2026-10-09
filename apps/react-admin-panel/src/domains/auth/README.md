# Авторизация администратора

Домен `auth` владеет входом, проверкой и завершением административной сессии,
допуском к панели, профилем и формой входа. Технический источник — `infra/backend-admin-api`.
Основной JWT действует 7 дней без продления. Refresh token, `/auth/refresh` и auth cookies отсутствуют.

## Публичный контракт

- `AuthProvider` подключается в `compositions/route-boundaries/authentication`, запускает bootstrap,
  следит за абсолютным окончанием сессии и изолирует приватный SWR-кеш.
  `shouldRestoreSession: false` приостанавливает bootstrap на Keycloak callback.
- `useAuthentication()` возвращает `checking`, `authenticated`, `guest` или `error` с безопасной причиной.
- `SignInForm`, `KeycloakSignIn`, `getSignInMethods`, `useGetSignInMethods` предоставляют способы входа.
  Отказ публичного списка провайдеров не блокирует локальную форму и не очищает ввод.
- `getCurrentUser` и `useGetCurrentUser` возвращают доменную модель профиля. Профиль хранится в SWR,
  не копируется в Zustand. Store содержит только допуск, revision, поколение кеша и абсолютный срок.
- `signIn`, `signInWithKeycloakCompletion`, `logout`, `retryBootstrap` реализуют lifecycle вне SWR.
- `rejectAuthentication(rejectedAccessToken)` используется адаптерами защищённых операций при terminal `401`.
  Поздний отказ прежнего credential не закрывает новую сессию.
- `getKeycloakSignInUrl`, `mapKeycloakCallbackError`, `getSignInErrorMessage` сохраняют прежний контракт UI.

## Bootstrap и завершение

1. Под Web Lock читается versioned credential из технического storage API-клиента.
   Повреждённый/просроченный JWT заменяется tombstone; отсутствие credential не вызывает auth-запросов.
2. `/auth/me` подтверждает активного пользователя до показа приватного интерфейса.
   Login/complete сохраняют JWT и неизменяемый срок ответа, затем выполняют ту же проверку.
3. Сбой сети, `429` или `5xx` закрывает неподтверждённый UI с возможностью повторить GET;
   credential сохраняется. Ни bootstrap, ни focus, ни reload не продлевают TTL.
4. Абсолютный expiry или terminal `401` закрывает доступ и требует нового входа.
   Таймер только завершает сессию, не выполняет ротацию или replay.
5. Logout захватывает Bearer **до** замены persisted credential на tombstone и закрытия локального доступа.
   Затем `POST /auth/logout` отзывает только эту сессию. `401` считается уже завершённой сессией;
   сетевой сбой даёт `LOGOUT_INCOMPLETE`, но не возвращает локальный доступ.
6. Смена/завершение сессии отделяет приватный SWR-кеш. Локальная revision и общее поколение записи защищают
   от поздних ответов bootstrap/login/logout. Если logout опередил ответ login, поздно выданный JWT
   не сохраняется и отправляется на отзыв. Неудачный новый login не удаляет прежний credential.

Unmount Provider очищает только runtime, не persistence. Повторное открытие документа восстанавливает
тот же JWT; storage failure не превращается в «просроченную сессию».

## Несколько вкладок и Keycloak

Credential хранится только в `infra/backend-admin-api` по scope публичного base URL.
Web Locks сериализуют вход и bootstrap; storage events и BroadcastChannel уведомляют соседние вкладки
без передачи токенов в сообщениях. Получатель закрывает прежний UI и перечитывает запись.
Logout/terminal rejection удаляют JWT, но оставляют общее поколение завершения в той же записи.
Явный logout **в guest и даже при отсутствующем ключе** записывает новое поколение tombstone.
Attempt запоминает общее поколение при вызове, проверяет его после ожидания Web Lock и после HTTP-ответа,
до сохранения JWT. Поэтому A.signIn, начатый из guest, после B.logout завершается `SUPERSEDED`;
выданный поздний JWT отправляется в compensating logout с explicit Bearer, не подменяемым текущим токеном.
Сами уведомления, bootstrap, focus и чтение tombstone не меняют поколение и не отменяют свой вход.
Same-tab logout ожидает собственный pending login и его компенсацию; ошибка компенсации даёт
`LOGOUT_INCOMPLETE` обоим Promise. Logout другой вкладки публикует завершение независимо от ожидания чужого HTTP;
компенсацией позднего ответа владеет вкладка, которая выполняла login.
Новый явный вход после tombstone запоминает уже новое поколение и может создать следующую сессию.
Нужны доступный localStorage, Web Locks, BroadcastChannel и безопасный контекст — HTTPS либо localhost.
Старые `ready`/`exchanging`/`signed-out` маркеры cookie-протокола больше не используются.

Keycloak login — браузерная навигация, не fetch. Одноразовый `/auth/keycloak/complete` сохраняет
`credentials: include`, CSRF header и completion cookie. Его Promise, включая завершённый, живёт
до конца документа: StrictMode и remount приватного кеша не повторяют mutation.
Повтор использованной completion cookie требует нового внешнего входа, не автоматического retry.
Обычный bootstrap приостановлен на callback. Неудачный complete не удаляет независимый прежний JWT.
Выход не завершает глобальную Keycloak SSO-сессию. OIDC tokens и client secret не попадают в storage.

Навигацией и безопасным `returnTo` владеют композиции и `shared/navigation`, не lifecycle.
Настройки TTL одноразовых transaction/completion не меняют фиксированные 7 дней административной сессии.

## Границы и проверки

Внешние потребители используют только фасет `domains/auth`. Внутренние adapters, operations,
providers, store и UI не образуют отдельных юнитов. Зависимости направлены к infra, не обратно.
Persistence и Bearer технические; решение о допуске, ошибки и очистка приватного кеша — доменные.

Существующие TSX изменяются без перегенерации. Новые TSX — только через локальный генератор.
После сборки актуального SDK, из корня приложения:

```sh
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run lint
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run check-types
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run build
```
