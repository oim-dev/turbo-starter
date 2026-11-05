/**
 * Сериализует асинхронные операции между вкладками через эксклюзивную readwrite-транзакцию.
 * Пока callback выполняется, цепочка запросов удерживает транзакцию; данные в БД не записываются.
 * В отличие от lease в localStorage, блокировка не истекает посреди сетевой операции.
 */
export const runWithIndexedDbLock = <T>(name: string, onAcquired: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(`browser-coordination:v1:${name}`, 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore('mutex')
    opening.onerror = () => reject(opening.error)
    opening.onsuccess = () => {
      const database = opening.result
      const transaction = database.transaction('mutex', 'readwrite')
      const store = transaction.objectStore('mutex')
      let hasStarted = false
      let outcome: { value: T } | { error: unknown } | undefined

      database.onversionchange = () => database.close()
      transaction.onabort = () => {
        database.close()
        reject(transaction.error ?? new Error('Browser coordination transaction aborted'))
      }
      transaction.oncomplete = () => {
        database.close()
        if (outcome === undefined) {
          reject(new Error('Browser coordination ended before the operation'))
          return
        }
        if ('error' in outcome) {
          reject(outcome.error)
          return
        }
        resolve(outcome.value)
      }

      /**
       * Ставит следующий запрос внутри активного IDB callback, пока операция не завершилась.
       */
      const keepAlive = (): void => {
        const request = store.get(0)
        request.onsuccess = () => {
          if (outcome !== undefined) return
          keepAlive()
          if (hasStarted) return
          hasStarted = true
          void Promise.resolve().then(onAcquired).then(
            (value) => { outcome = { value } },
            (error: unknown) => { outcome = { error } }
          )
        }
      }

      keepAlive()
    }
  })
}
