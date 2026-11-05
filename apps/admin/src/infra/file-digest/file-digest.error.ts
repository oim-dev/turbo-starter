/**
 * Причины технического отказа вычисления отпечатка.
 */
export const FILE_DIGEST_ERROR_CODE = {
  /**
   * WebCrypto отсутствует или контекст небезопасен.
   */
  UNAVAILABLE: 'UNAVAILABLE',
  /**
   * Исходные байты недоступны для чтения.
   */
  READ_FAILED: 'READ_FAILED',
  /**
   * WebCrypto отклонил вычисление SHA-256.
   */
  HASH_FAILED: 'HASH_FAILED'
} as const

/**
 * Технический отказ чтения или вычисления отпечатка файла.
 */
export class FileDigestError extends Error {
  /**
   * Отличает отсутствие WebCrypto от недоступного содержимого файла.
   */
  constructor(readonly code: (typeof FILE_DIGEST_ERROR_CODE)[keyof typeof FILE_DIGEST_ERROR_CODE]) {
    super(`File digest failed: ${code}`)
    this.name = 'FileDigestError'
  }
}
