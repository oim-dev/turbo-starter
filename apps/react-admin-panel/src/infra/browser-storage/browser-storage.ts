import { BrowserStorageError } from './errors/browser-storage.error'

/**
 * Normalizes access failures for both origin-shared and tab-local storage.
 */
const executeStorageOperation = <TValue>(
  operation: 'read' | 'remove' | 'write',
  onStorage: (storage: Storage) => TValue,
  area: 'local' | 'session'
): TValue => {
  try {
    return onStorage(area === 'local' ? window.localStorage : window.sessionStorage)
  } catch (cause) {
    throw new BrowserStorageError(operation, cause)
  }
}

/** Возвращает сохранённое строковое значение либо `null`. */
export const readBrowserStorage = (key: string, area: 'local' | 'session' = 'local'): string | null => {
  return executeStorageOperation('read', (storage) => storage.getItem(key), area)
}

/** Сохраняет строковое значение под указанным ключом. */
export const writeBrowserStorage = (key: string, value: string, area: 'local' | 'session' = 'local'): void => {
  executeStorageOperation('write', (storage) => storage.setItem(key, value), area)
}

/** Идемпотентно удаляет значение указанного ключа. */
export const removeBrowserStorage = (key: string, area: 'local' | 'session' = 'local'): void => {
  executeStorageOperation('remove', (storage) => storage.removeItem(key), area)
}
