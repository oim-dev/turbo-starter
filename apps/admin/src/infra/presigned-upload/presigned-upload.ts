import { isOneOf } from '@biocad/value-predicates'

import { PresignedUploadError } from './presigned-upload.error'
import type { PresignedFormUpload } from './types/presigned-form-upload.type'

const UPLOAD_PROTOCOLS = ['http:', 'https:'] as const

/**
 * Проверяет, что подписанный upload URL использует HTTP transport.
 */
const parseUploadUrl = (value: string): URL => {
  try {
    const url = new URL(value)

    if (isOneOf(url.protocol, UPLOAD_PROTOCOLS)) {
      return url
    }
  } catch {
    // Ошибка URL получает единый infra outcome ниже.
  }

  throw new PresignedUploadError()
}

/**
 * Собирает multipart body без ручной установки Content-Type boundary.
 */
const createUploadFormData = (input: PresignedFormUpload): FormData => {
  const formData = new FormData()

  for (const [name, value] of Object.entries(input.fields)) {
    formData.append(name, value)
  }

  formData.append('file', input.file)

  return formData
}

/**
 * Загружает форму через XHR, когда вызывающему UI нужен browser upload progress.
 */
const uploadPresignedFormWithProgress = async (
  uploadUrl: URL,
  formData: FormData,
  input: PresignedFormUpload
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()

    /**
     * Удаляет внешний abort listener после завершения запроса.
     */
    const cleanup = (): void => {
      input.signal?.removeEventListener('abort', handleAbortSignal)
    }

    /**
     * Завершает запрос единой infra-ошибкой.
     */
    const rejectUpload = (): void => {
      cleanup()
      reject(new PresignedUploadError())
    }

    /**
     * Отменяет XHR вместе с lifecycle вызывающего сценария.
     */
    const handleAbortSignal = (): void => {
      request.abort()
    }

    /**
     * Передаёт вычислимый byte progress вызывающему UI.
     */
    const handleProgress = (event: ProgressEvent): void => {
      if (event.lengthComputable) {
        input.onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }

    /**
     * Интерпретирует HTTP status завершённого storage POST.
     */
    const handleLoad = (): void => {
      cleanup()

      if (request.status >= 200 && request.status < 300) {
        input.onProgress?.(100)
        resolve()
        return
      }

      reject(new PresignedUploadError())
    }

    if (input.signal?.aborted) {
      rejectUpload()
      return
    }

    request.open('POST', uploadUrl)
    request.withCredentials = false
    request.upload.addEventListener('progress', handleProgress)
    request.addEventListener('abort', rejectUpload, { once: true })
    request.addEventListener('error', rejectUpload, { once: true })
    request.addEventListener('load', handleLoad, { once: true })
    input.signal?.addEventListener('abort', handleAbortSignal, { once: true })
    request.send(formData)
  })
}

/**
 * Отправляет файл непосредственно в object storage по подписанному POST.
 *
 * Content-Type не задаётся вручную, чтобы browser добавил FormData boundary.
 */
export const uploadPresignedForm = async (input: PresignedFormUpload): Promise<void> => {
  const uploadUrl = parseUploadUrl(input.url)
  const formData = createUploadFormData(input)

  if (input.onProgress) {
    await uploadPresignedFormWithProgress(uploadUrl, formData, input)
    return
  }

  const response = await fetch(uploadUrl, {
    body: formData,
    credentials: 'omit',
    method: 'POST',
    signal: input.signal
  })

  if (!response.ok) {
    throw new PresignedUploadError()
  }
}
