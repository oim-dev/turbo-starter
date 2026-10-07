export type BrowserStorageOperation = 'read' | 'remove' | 'write'

/** Описывает техническую недоступность browser storage. */
export class BrowserStorageError extends Error {
  readonly operation: BrowserStorageOperation

  constructor(operation: BrowserStorageOperation, cause: unknown) {
    super(`Browser storage operation failed: ${operation}`, { cause })
    this.name = 'BrowserStorageError'
    this.operation = operation
  }
}

/** Проверяет техническую ошибку browser storage. */
export const isBrowserStorageError = (error: unknown): error is BrowserStorageError => {
  return error instanceof BrowserStorageError
}
