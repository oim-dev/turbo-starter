import { useEffect, useEffectEvent } from 'react'
import { unstable_serialize, useSWRConfig } from 'swr'
import type { Arguments, Cache, ScopedMutator } from 'swr'

type ActiveSwrCacheKey = Exclude<Arguments, null | undefined | false>

type RegisteredSwrCacheKey = {
  key: ActiveSwrCacheKey
  mountedConsumers: number
  pendingUpdates: Array<(data: unknown) => unknown>
}

type SwrCacheKeyRegistry = Map<string, RegisteredSwrCacheKey>
type SwrCacheRevalidationQueue = Map<string, Promise<void>>
type SwrCacheRequestGenerations = Map<string, number>

/** Изменяет сохранённые данные одного SWR key без создания отсутствующей записи. */
export type SwrCacheDataUpdater<Data> = (
  currentData: Data | undefined
) => Data | undefined

/** Выбирает ключи SWR по их исходным аргументам. */
export type SwrCacheKeyPredicate = (key: Arguments) => boolean

/** Повторно валидирует exact или выбранные зарегистрированные SWR keys. */
export type SwrCacheRevalidator = Readonly<{
  revalidateKey: (key: Arguments) => Promise<void>
  revalidateMatchingKeys: (predicate: SwrCacheKeyPredicate) => Promise<void>
}>

/** Обновляет данные зарегистрированного SWR key в общей очереди операций. */
export type SwrCacheUpdater = <Data>(
  key: Arguments,
  update: SwrCacheDataUpdater<Data>
) => Promise<void>

const cacheKeyRegistries = new WeakMap<Cache, SwrCacheKeyRegistry>()
const cacheRevalidationQueues = new WeakMap<Cache, SwrCacheRevalidationQueue>()
const cacheRequestGenerations = new WeakMap<Cache, SwrCacheRequestGenerations>()

/** Возвращает registry, принадлежащий конкретному cache provider. */
const getCacheKeyRegistry = (cache: Cache): SwrCacheKeyRegistry => {
  const existingRegistry = cacheKeyRegistries.get(cache)

  if (existingRegistry !== undefined) {
    return existingRegistry
  }

  const registry: SwrCacheKeyRegistry = new Map()
  cacheKeyRegistries.set(cache, registry)

  return registry
}

/** Возвращает очередь повторных валидаций конкретного cache provider. */
const getCacheRevalidationQueue = (
  cache: Cache
): SwrCacheRevalidationQueue => {
  const existingQueue = cacheRevalidationQueues.get(cache)

  if (existingQueue !== undefined) {
    return existingQueue
  }

  const queue: SwrCacheRevalidationQueue = new Map()
  cacheRevalidationQueues.set(cache, queue)

  return queue
}

/** Повышает generation запроса и возвращает её новое значение. */
const advanceCacheRequestGeneration = (
  cache: Cache,
  serializedKey: string
): number => {
  let generations = cacheRequestGenerations.get(cache)

  if (generations === undefined) {
    generations = new Map()
    cacheRequestGenerations.set(cache, generations)
  }

  const generation = (generations.get(serializedKey) ?? 0) + 1
  generations.set(serializedKey, generation)

  return generation
}

/** Проверяет, не был ли запрос вытеснен более новой cache operation. */
const isCurrentCacheRequest = (
  cache: Cache,
  serializedKey: string,
  generation: number
): boolean => {
  return cacheRequestGenerations.get(cache)?.get(serializedKey) === generation
}

/** Удаляет данные ключа, если его последний React consumer уже размонтирован. */
const clearInactiveCacheKey = async (
  cache: Cache,
  registry: SwrCacheKeyRegistry,
  serializedKey: string,
  registeredKey: RegisteredSwrCacheKey,
  mutate: ScopedMutator
): Promise<void> => {
  advanceCacheRequestGeneration(cache, serializedKey)

  try {
    await mutate(registeredKey.key)
  } catch {
    // Key уже не имеет consumers; ошибка или disposed provider не наблюдаемы UI.
  }

  cache.delete(serializedKey)

  if (
    registry.get(serializedKey) === registeredKey
    && registeredKey.mountedConsumers === 0
  ) {
    registry.delete(serializedKey)
  }
}

/** Выполняет одну повторную валидацию по актуальному состоянию consumers. */
const runCacheKeyRevalidation = async (
  cache: Cache,
  mutate: ScopedMutator,
  serializedKey: string
): Promise<void> => {
  const registry = getCacheKeyRegistry(cache)
  const registeredKey = registry.get(serializedKey)

  if (registeredKey === undefined) {
    return
  }

  if (registeredKey.mountedConsumers === 0) {
    await clearInactiveCacheKey(
      cache,
      registry,
      serializedKey,
      registeredKey,
      mutate
    )
    return
  }

  advanceCacheRequestGeneration(cache, serializedKey)

  try {
    await mutate(registeredKey.key)
  } catch (error) {
    if (registeredKey.mountedConsumers === 0) {
      await clearInactiveCacheKey(
        cache,
        registry,
        serializedKey,
        registeredKey,
        mutate
      )
      return
    }

    throw error
  }

  if (registeredKey.mountedConsumers === 0) {
    await clearInactiveCacheKey(
      cache,
      registry,
      serializedKey,
      registeredKey,
      mutate
    )
    return
  }

  const cacheError = cache.get(serializedKey)?.error

  if (cacheError !== undefined) {
    throw cacheError
  }
}

/** Выполняет локальное обновление по актуальному состоянию consumers. */
const runCacheKeyUpdate = async <Data>(
  cache: Cache,
  mutate: ScopedMutator,
  serializedKey: string,
  update: SwrCacheDataUpdater<Data>
): Promise<void> => {
  const registry = getCacheKeyRegistry(cache)
  const registeredKey = registry.get(serializedKey)

  if (registeredKey === undefined) {
    return
  }

  if (registeredKey.mountedConsumers === 0) {
    await clearInactiveCacheKey(
      cache,
      registry,
      serializedKey,
      registeredKey,
      mutate
    )
    return
  }

  const currentData = cache.get(serializedKey)?.data as Data | undefined

  if (currentData === undefined) {
    registeredKey.pendingUpdates.push((data) => {
      return update(data as Data | undefined)
    })
    return
  }

  const updatedData = update(currentData)
  advanceCacheRequestGeneration(cache, serializedKey)
  await mutate<Data>(registeredKey.key, updatedData, { revalidate: false })

  if (registeredKey.mountedConsumers === 0) {
    await clearInactiveCacheKey(
      cache,
      registry,
      serializedKey,
      registeredKey,
      mutate
    )
  }
}

/** Сериализует cache operation одного ключа внутри конкретного provider. */
const scheduleCacheKeyOperation = (
  cache: Cache,
  serializedKey: string,
  operation: () => Promise<void>
): Promise<void> => {
  const queue = getCacheRevalidationQueue(cache)
  const previousRequest = queue.get(serializedKey) ?? Promise.resolve()
  const currentRequest = previousRequest
    .catch(() => undefined)
    .then(operation)

  queue.set(serializedKey, currentRequest)

  const clearCompletedRequest = (): void => {
    if (queue.get(serializedKey) === currentRequest) {
      queue.delete(serializedKey)
    }
  }

  void currentRequest.then(clearCompletedRequest, clearCompletedRequest)

  return currentRequest
}

/** Сериализует revalidation одного ключа внутри конкретного cache provider. */
const scheduleCacheKeyRevalidation = (
  cache: Cache,
  mutate: ScopedMutator,
  serializedKey: string
): Promise<void> => {
  return scheduleCacheKeyOperation(
    cache,
    serializedKey,
    () => runCacheKeyRevalidation(cache, mutate, serializedKey)
  )
}

/**
 * Регистрирует mounted consumer и защищает его fetcher от stale error commit.
 */
export const useSwrCacheLifecycle = <Data, CacheKey extends ActiveSwrCacheKey>(
  key: CacheKey | null,
  fetcher: (key: CacheKey) => Promise<Data>
): ((key: CacheKey) => Promise<Data>) => {
  const { cache } = useSWRConfig()
  const serializedKey = key ? unstable_serialize(key) : null
  const registerCurrentKey = useEffectEvent(() => {
    if (!key || serializedKey === null) {
      return
    }

    const registry = getCacheKeyRegistry(cache)
    const registeredKey = registry.get(serializedKey)

    if (registeredKey === undefined) {
      registry.set(serializedKey, {
        key,
        mountedConsumers: 1,
        pendingUpdates: []
      })
    } else {
      registeredKey.mountedConsumers += 1
    }

    return () => {
      const currentRegisteredKey = registry.get(serializedKey)

      if (currentRegisteredKey !== undefined) {
        currentRegisteredKey.mountedConsumers = Math.max(
          currentRegisteredKey.mountedConsumers - 1,
          0
        )
      }
    }
  })

  useEffect(() => registerCurrentKey(), [cache, serializedKey])

  return async (requestKey) => {
    const requestSerializedKey = unstable_serialize(requestKey)
    const requestGeneration = advanceCacheRequestGeneration(
      cache,
      requestSerializedKey
    )

    try {
      let data = await fetcher(requestKey) as Data
      const registeredKey = getCacheKeyRegistry(cache).get(requestSerializedKey)

      if (
        isCurrentCacheRequest(cache, requestSerializedKey, requestGeneration)
        && registeredKey !== undefined
        && registeredKey.pendingUpdates.length > 0
      ) {
        const pendingUpdates = registeredKey.pendingUpdates.splice(0)

        for (const update of pendingUpdates) {
          data = update(data) as Data
        }
      }

      return data
    } catch (error) {
      if (
        !isCurrentCacheRequest(cache, requestSerializedKey, requestGeneration)
      ) {
        return cache.get(requestSerializedKey)?.data as Data
      }

      throw error
    }
  }
}

/** Возвращает cache-scoped операции безопасной повторной валидации. */
export const useRevalidateSwrCache = (): SwrCacheRevalidator => {
  const { cache, mutate } = useSWRConfig()

  const revalidateKey = (key: Arguments): Promise<void> => {
    if (!key) {
      return Promise.resolve()
    }

    return scheduleCacheKeyRevalidation(cache, mutate, unstable_serialize(key))
  }

  const revalidateMatchingKeys = (
    predicate: SwrCacheKeyPredicate
  ): Promise<void> => {
    const registry = getCacheKeyRegistry(cache)
    const matchingKeys = [...registry.entries()]
      .filter(([, registeredKey]) => predicate(registeredKey.key))
      .map(([serializedKey]) => serializedKey)

    return Promise.all(
      matchingKeys.map((serializedKey) => {
        return scheduleCacheKeyRevalidation(cache, mutate, serializedKey)
      })
    ).then(() => undefined)
  }

  return { revalidateKey, revalidateMatchingKeys }
}

/** Возвращает cache-scoped локальное обновление зарегистрированного key. */
export const useUpdateSwrCache = (): SwrCacheUpdater => {
  const { cache, mutate } = useSWRConfig()

  return <Data>(
    key: Arguments,
    update: SwrCacheDataUpdater<Data>
  ): Promise<void> => {
    if (!key) {
      return Promise.resolve()
    }

    const serializedKey = unstable_serialize(key)

    return scheduleCacheKeyOperation(
      cache,
      serializedKey,
      () => runCacheKeyUpdate(cache, mutate, serializedKey, update)
    )
  }
}
