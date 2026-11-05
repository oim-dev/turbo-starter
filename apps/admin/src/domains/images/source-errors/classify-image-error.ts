import { rejectAuthentication } from 'domains/management/auth'
import { getBackendAdminApiErrorAccessToken, isBackendAdminApiError } from 'infra/backend-admin-api'
import { FileDigestError } from 'infra/file-digest'
import { PresignedUploadError } from 'infra/presigned-upload'
import { toApplicationDefect } from 'shared/errors'
import { hasOwn, isRecord } from 'shared/value-predicates'
import { ImageError } from '../errors/image.error'

/**
 * Интерпретирует ожидаемые отказы источника; неизвестные ошибки записи остаются defects.
 */
export const classifyImageError = (error: unknown, isRead = false): Error => {
  if (error instanceof ImageError) return error
  if (error instanceof PresignedUploadError) return new ImageError('UPLOAD_FAILED')
  if (error instanceof FileDigestError) {
    return new ImageError(error.code === 'UNAVAILABLE' ? 'HASH_UNAVAILABLE' : 'FILE_CHECK_FAILED')
  }
  if (isBackendAdminApiError(error)) {
    if (error.status === 401) {
      rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
      return new ImageError('FORBIDDEN')
    }
    if (error.status === 403) return new ImageError('FORBIDDEN')
    if (error.status === 404) return new ImageError('NOT_FOUND')
    if (isRecord(error.error) && hasOwn(error.error, 'code') && error.error.code === 'IMAGE_HASH_MISMATCH') {
      return new ImageError('HASH_MISMATCH')
    }
    if (error.status === 409) return new ImageError('CONFLICT')
    if (error.status === 413) return new ImageError('TOO_LARGE')
    if (error.status === 400 || error.status === 415 || error.status === 422) return new ImageError('INVALID_INPUT')
    if (error.status === 0 || error.status === 429 || error.status >= 500) return new ImageError('UNAVAILABLE')
  }
  const isNetworkFailure = error instanceof TypeError
    && ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'].includes(error.message)
  const isTimeout = error instanceof DOMException && error.name === 'AbortError'
  if (isRead || isNetworkFailure || isTimeout) return new ImageError('UNAVAILABLE')
  return toApplicationDefect('images.operation', error)
}
