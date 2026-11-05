# GET data

Используй `useSWR` для REST GET-data, которая представляет server state и участвует в React render browser-only SPA. Public domain hook вызывает domain GET adapter, уже подготовленный по основной инструкции [`REST data fetching`](../../application/data-fetching/rest.md).

```text
useSWR
→ domain GET adapter
→ infra REST operation / API client
→ configured HttpClient
→ REST API
```

SWR не создаёт transport или client. Infra API-модуль собирается через [`@gromlab/rest-api-codegen`](../rest-api-codegen/README.md), а domain adapter выполняет mapping DTO и source errors до записи результата в cache.

## Преимущества

- одинаковые keys используют общий client cache и дедуплицируют одновременные запросы;
- каждый consumer получает единые `data`, `error`, `isLoading`, `isValidating` и `mutate`;
- focus, browser reconnect и ручная revalidation обновляют данные без собственного `useEffect`;
- `null` key отключает запрос до появления обязательных параметров;
- несколько компонентов используют один remote state без копирования в Context или Zustand;
- fetcher вызывает domain GET adapter, сохраняет в cache доменную модель и передаёт ожидаемую domain error через проверенный error channel.

## Только GET

Remote request внутри `useSWR` выполняет только HTTP `GET`.

- Не выполняй через `useSWR` или `useSWRMutation` методы `POST`, `PUT`, `PATCH` и `DELETE`.
- Не используй `useSWRMutation` как второй способ выполнения REST-запросов.
- Изменяющие operations выполняй вне SWR через public domain adapter.
- После изменения синхронизируй связанные GET keys через `mutate`.
- Read-operation через `POST` также выполняй через public domain adapter вне SWR. Operation не становится GET-cache только из-за того, что не изменяет данные.

Императивный GET для download, export или другого результата, который не является server state для render, выполняй через public domain GET adapter. Не помещай binary response и одноразовый side effect в SWR cache без отдельной причины.

Такая граница исключает автоматический запуск изменяющего запроса при mount, focus или reconnect, неоднозначный retry и
смешивание mutation state с cache чтения.

## Структура hook

Размещай hook, key generator и типы рядом внутри домена-владельца. При текущем code style структура выглядит так:

```text
use-get-<name>/
├── types/
│   └── use-get-<name>.type.ts
├── get-<name>-key.ts
└── use-get-<name>.hook.ts
```

Части шаблона:

- `use-get-` — обязательный префикс папки и файла GET-hook;
- `get-` и `-key` — обязательные части имени key generator;
- `<name>` — имя после `useGet` в экспортируемой функции, записанное в `kebab-case`.

Ролевые суффиксы файлов определяет актуальный code style проекта, а не технология SWR.

Примеры:

| Экспортируемая функция | `<name>` | Папка hook |
| --- | --- | --- |
| `useGetCurrentSession` | `current-session` | `use-get-current-session/` |
| `useGetCurrentUser` | `current-user` | `use-get-current-user/` |
| `useGetPet` домена | `pet` | `pet-domain/hooks/use-get-pet/` |

- Hook именуется через `useGet...`.
- Key generator экспортируется для hook и внешней revalidation.
- Key generator не импортирует hook, domain adapter или infra API-модуль.
- Hook-файл экспортирует только hook.
- Внешний consumer получает hook и adapter через фасет домена, а не глубокий импорт.

Простой пример без параметров находится в
[`demo-app/current-session`](../../../demo-app/src/domains/authentication/hooks/use-get-current-session/).

## Cache key

Используй tuple key со стабильным namespace и всеми аргументами, влияющими на результат:

```ts
export type GetPetKey = readonly ['pet-store-api/pets/get-pet', string]
```

```ts
export const getPetKey = (id: string | null): GetPetKey | null => {
  if (id === null) {
    return null
  }

  return ['pet-store-api/pets/get-pet', id]
}
```

SWR передаёт fetcher tuple целиком одним аргументом.

Не смешивай DTO и доменную модель под одним key. Разные представления получают разные namespaces, иначе consumers
прочитают несовместимые значения из общего cache entry.

## Auth scope

Приватный GET разрешён только после подтверждения JWT-сессии backend по [авторизации](../../application/authentication/README.md).
До этого его ключ равен `null`; наличие сохранённого токена или старой `data` не открывает доступ к запросу.

Создавай отдельный приватный `SWRConfig` Provider на каждое поколение сессии. Внутри него ключ также содержит
идентификатор пользователя и все параметры, влияющие на результат. Следующие примеры с `userId` используются только
в такой области: её владелец монтирует приватных потребителей после подтверждения сессии и отключает при её завершении.
Сам по себе `userId` в общем кеше не разделяет два последовательных входа того же пользователя.

```ts
export type GetAuthPetKey = readonly [
  'private',
  string,
  'pet-store-api/pets/get-pet',
  string
]
```

```ts
export const getAuthPetKey = (
  userId: string | null,
  petId: string | null
): GetAuthPetKey | null => {
  if (userId === null || petId === null) {
    return null
  }

  return ['private', userId, 'pet-store-api/pets/get-pet', petId]
}
```

Не передавай `userId` в каждый hook из component. Auth-aware hook самостоятельно получает текущего пользователя и
передаёт stable ID в key generator:

```ts
export const useGetAuthPet = (petId: string | null): UseGetAuthPetResponse => {
  const user = useGetUser()
  const userId = user.data?.userId ?? null
  const key = getAuthPetKey(userId, petId)
  const fetcher = ([, , , currentPetId]: GetAuthPetKey) => {
    return getPet(currentPetId)
  }

  return useSWR<GetAuthPetData, GetAuthPetError, GetAuthPetKey | null>(key, fetcher)
}
```

В пределах приватного Provider ключи используют форму `['private', userId, namespace, ...resourceArgs]`.
Префикс позволяет владельцу авторизации отключать приватные данные, не затрагивая публичные. `userId` участвует
только в идентификации кеша. Загрузчик передаёт адаптеру параметры ресурса, а JWT добавляет настроенный `HttpClient`
внутри API-модуля. После подтверждения сессии отсутствие нужных данных `useGetUser` дополнительно сохраняет `null` key.

`useGetUser` является единым владельцем текущей auth identity. Resource hooks читают её внутри себя и не заставляют
каждый component получать и передавать `userId` вручную.

Hook скрывает auth context от consumer и вызывается только с параметрами своего ресурса:

```ts
const pet = useGetAuthPet(petId)
```

Поколение Provider задаётся безопасным идентификатором сессии или счётчиком владельца авторизации.
Новое поколение требуется при каждом входе, включая того же пользователя. Если организация или версия прав
меняют смысл ответа, учитывай их в области или ключе. Обычное обновление JWT в прежней сессии само по себе
не пересоздаёт область. Не помещай в ключ или идентификатор Provider JWT, refresh token, cookie и их производные значения.

При выходе или смене сессии:

1. Закрой приватный интерфейс и отключи хуки через `null` key, даже если в них ещё есть прежняя `data`.
2. Заверши старую область и очисти её кеш; отмени незавершённые запросы, где это возможно.
3. После подтверждения новой сессии создай новый Provider с отдельным `Map`, а не переиспользуй старый.
4. Поздний ответ остаётся в недоступной старой области. Перед внешним `mutate`, записью в хранилище, обработчиком или повтором
   запроса сравни захваченное поколение с текущим по [правилам состояния](../../application/state-management/README.md#приватная-область-сессии).

API очистки кеша меняется между версиями SWR. Не полагайся на неподтверждённый `useSWRConfig().unload()`:
перед реализацией выхода и смены пользователя сверь очистку Provider и поведение незавершённых запросов
по установленной версии и официальной [документации SWR](https://swr.vercel.app/).
Публичные данные остаются вне приватного Provider и не очищаются вместе с ним.

Очистку выполняет владелец сессии один раз при смене поколения, а не каждый приватный хук.
Не используй `keepPreviousData` между областями: предыдущие пользовательские данные не отображаются после смены сессии.

В [`demo-app/current-user`](../../../demo-app/src/domains/user/hooks/use-get-current-user/) показана форма приватного ключа.
Пример пока не реализует отдельный Provider на поколение сессии; ограничение отмечено в
[GAP-013](../../../DOCUMENTATION-GAPS.md#gap-013-поколения-сессии-и-поздние-ответы-в-демо).

## Fetcher и response

Fetcher остаётся локальной функцией hook и выполняет domain GET adapter:

```ts
export const useGetPet = (id: string | null): UseGetPetResponse => {
  const key = getPetKey(id)
  const fetcher = ([, petId]: GetPetKey) => getPet(petId)

  return useSWR<GetPetData, GetPetError, GetPetKey | null>(key, fetcher)
}
```

Не создавай в fetcher самостоятельный `fetch`, `HttpClient`, API client, URL, auth headers или общую обработку HTTP-ошибок. Их предоставляет готовый infra API-модуль внутри domain adapter.

Доменный хук возвращает стандартный `SWRResponse<Data, OperationError>`. Не переименовывай и не удаляй поля ответа, не
добавляй отдельное поле `defect`. Потребитель читает типизированную доменную ошибку из стандартного `error`, а для
повторного запроса или обновления кеша использует стандартный `mutate`.

```ts
export type UseGetPetResponse = SWRResponse<GetPetData, GetPetError>
```

## Domain adapter

Не добавляй DTO mapping и интерпретацию source errors в SWR hook. Передай в fetcher готовый domain GET adapter:

```ts
const fetcher = ([, petId]: GetPetKey) => getPet(petId)
```

Адаптер, преобразования и интерпретация ошибок источника остаются внутри домена, а технический HTTP-транспорт принадлежит
`infra`. SWR отвечает только за ключ, кеш и жизненный цикл React.

Успешный предметный результат становится `data`. GET-адаптер до передачи управления SWR преобразует каждый неуспешный
исход в одну из ошибок своей операции, включая запасную ошибку временной недоступности. Хук не проверяет ошибку повторно
и не создаёт новую модель ошибок. Полная классификация определена в правилах
[`доменных ошибок`](../../application/architecture/units/domains/errors.md#граница-get-адаптера-для-swr).

Рабочий контракт стандартного ответа показан в типах
[`useGetCurrentSession`](../../../demo-app/src/domains/authentication/hooks/use-get-current-session/types/use-get-current-session.type.ts)
и
[`useGetCurrentUser`](../../../demo-app/src/domains/user/hooks/use-get-current-user/types/use-get-current-user.type.ts).

Domain hook принадлежит доменному юниту вместе с его contract, errors, mappers и adapters. Внешние consumers получают hook через public facet домена; не размещай его во внешнем общем каталоге hooks.

## Revalidation после mutation

После успешного mutation adapter call предпочитай повторный GET через bound `mutate()` в domain action/hook или другом явном lifecycle owner:

```ts
const pet = useGetPet(id)

await updatePet({ id, name })
await pet.mutate()
```

Revalidation получает каноническое состояние сервера и не предполагает, что response mutation совпадает с GET-data.

Используй `useSWRConfig().mutate`, когда изменённый cache не принадлежит текущему consumer или требуется обновить
несколько keys. Для адресного обновления переиспользуй экспортированный key generator:

```ts
const { mutate } = useSWRConfig()

await updatePet({ id, name })
await mutate(getPetKey(id))
```

Global `mutate(key)` без data запускает revalidation только когда соответствующий GET-hook mounted в том же cache
provider. Если mounted consumer отсутствует, выполни явный сценарий обновления при следующем mount или передай data.

## Ручное обновление cache

Optimistic data, rollback и ручное merge применяй только когда обычная revalidation не решает задачу. Определи:

- optimistic state;
- rollback при ошибке;
- необходимость финальной revalidation;
- связанные detail и list keys;
- защиту от race conditions.

Для изменения на основе текущего значения используй functional `mutate(current => next)`, а не значение из render
closure.

## Проверка

- Fetcher выполняет domain GET adapter.
- Key содержит namespace и все влияющие на результат аргументы.
- Приватный GET не начинается до подтверждения сессии; её поколения имеют отдельные Provider и не принимают поздние ответы друг друга.
- Remote data не копируются в другой client store.
- Mutation выполняется через public domain adapter вне SWR.
- Mutation синхронизирует связанные GET keys.
- Доменный кеш не содержит DTO и ошибок источника; GET-адаптер полностью классифицирует ошибки до SWR.
- Хук возвращает стандартный `SWRResponse`, включая `error` и `mutate`.
- Hook не создаёт transport, API client или REST operation.
- `dedupingInterval` не описан как TTL: он только подавляет повторные запросы внутри интервала.
