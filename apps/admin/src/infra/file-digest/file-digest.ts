import { computeFileSha256InChunks } from './chunked-file-digest'
import { FILE_DIGEST_ERROR_CODE, FileDigestError } from './file-digest.error'
import { readFileBytes } from './helpers/read-file-bytes'

/**
 * Возвращает SHA-256 исходных байтов в lowercase hex.
 * На HTTP использует существующий потоковый WASM; WebCrypto отменяется на уровне ожидания результата.
 */
export const computeFileSha256 = async (file: Blob, signal: AbortSignal): Promise<string> => {
  signal.throwIfAborted()
  if (!globalThis.isSecureContext || globalThis.crypto?.subtle === undefined) {
    return computeFileSha256InChunks(file, signal)
  }
  const bytes = await readFileBytes(file, signal)
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    /**
     * Завершает ожидание отменённого вычисления без дальнейшей отправки файла.
     */
    const handleAbort = (): void => reject(signal.reason)
    signal.addEventListener('abort', handleAbort, { once: true })
    void globalThis.crypto.subtle.digest('SHA-256', bytes).then((digest) => {
      if (signal.aborted) return
      resolve(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''))
    }, () => {
      if (!signal.aborted) reject(new FileDigestError(FILE_DIGEST_ERROR_CODE.HASH_FAILED))
    }).finally(() => signal.removeEventListener('abort', handleAbort))
  })
}
