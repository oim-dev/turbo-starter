import type { PresignedUploadInput } from './types/presigned-upload.type'

/**
 * Описывает сбой бинарной передачи без данных подписанного URL.
 */
export class PresignedUploadError extends Error {
  /**
   * Создаёт безопасную техническую ошибку передачи.
   */
  constructor(readonly status: number) {
    super('Presigned upload failed')
    this.name = 'PresignedUploadError'
  }
}

/**
 * Отправляет бинарные данные без cookie/JWT и без автоматического повторения PUT.
 */
export const uploadPresignedFile = (input: PresignedUploadInput): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    /**
     * Освобождает подписку отмены после завершения запроса.
     */
    const cleanup = (): void => input.signal.removeEventListener('abort', handleAbort)
    /**
     * Прерывает запрос при завершении жизненного цикла владельца.
     */
    const handleAbort = (): void => request.abort()
    if (input.signal.aborted) {
      reject(new DOMException('Upload cancelled', 'AbortError'))
      return
    }
    request.open('PUT', input.url)
    request.withCredentials = false
    request.timeout = 300_000
    for (const [name, header] of Object.entries(input.headers)) {
      if (name.toLowerCase() === 'authorization' || name.toLowerCase() === 'cookie') {
        reject(new PresignedUploadError(0))
        return
      }
      request.setRequestHeader(name, header)
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      cleanup()
      if (request.status >= 200 && request.status < 300) {
        input.onProgress(100)
        resolve()
        return
      }
      reject(new PresignedUploadError(request.status))
    }
    request.onerror = request.ontimeout = () => {
      cleanup()
      reject(new PresignedUploadError(request.status))
    }
    request.onabort = () => {
      cleanup()
      reject(new DOMException('Upload cancelled', 'AbortError'))
    }
    input.signal.addEventListener('abort', handleAbort, { once: true })
    request.send(input.file)
  })
}
