import { FILE_DIGEST_ERROR_CODE, FileDigestError } from '../file-digest.error'

/**
 * Читает исходные байты с остановкой FileReader и очисткой подписок при отмене.
 */
export const readFileBytes = (file: Blob, signal: AbortSignal): Promise<ArrayBuffer> => {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    /**
     * Освобождает обработчики завершённого чтения.
     */
    const cleanup = (): void => {
      signal.removeEventListener('abort', handleAbort)
      reader.onload = null
      reader.onerror = null
      reader.onabort = null
    }
    /**
     * Останавливает чтение до вычисления отпечатка.
     */
    const handleAbort = (): void => {
      cleanup()
      reader.abort()
      reject(signal.reason)
    }
    reader.onload = () => {
      cleanup()
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new FileDigestError(FILE_DIGEST_ERROR_CODE.READ_FAILED))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = reader.onabort = () => {
      cleanup()
      reject(new FileDigestError(FILE_DIGEST_ERROR_CODE.READ_FAILED))
    }
    signal.addEventListener('abort', handleAbort, { once: true })
    try {
      reader.readAsArrayBuffer(file)
    } catch {
      cleanup()
      reject(new FileDigestError(FILE_DIGEST_ERROR_CODE.READ_FAILED))
    }
  })
}
