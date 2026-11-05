import { rejectAuthentication } from 'domains/management/auth'
import { getBackendAdminApiErrorAccessToken, isBackendAdminApiError } from 'infra/backend-admin-api'
import { PresignedUploadError } from 'infra/presigned-upload'
import { FileDigestError } from 'infra/file-digest'
import { toApplicationDefect } from 'shared/errors'
import { hasOwn, isRecord } from 'shared/value-predicates'
import { FileError } from '../errors/file.error'

/**
 * Закрывает канал ошибок источника и отзывает только отклонённую сессию.
 */
export const classifyFileError = (error: unknown, isRead = false): Error => {
  if (error instanceof FileError) return error
  if (error instanceof FileDigestError) return new FileError('HASH_UNAVAILABLE')
  if (error instanceof PresignedUploadError) return new FileError('UPLOAD_FAILED')
  if (isBackendAdminApiError(error)) {
    if (error.status === 401) {
      rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
      return new FileError('FORBIDDEN')
    }
    if (error.status === 403) return new FileError('FORBIDDEN')
    if (error.status === 404) return new FileError('NOT_FOUND')
    const code = isRecord(error.error) && hasOwn(error.error, 'code') ? error.error.code : null
    if (code === 'FILE_SIZE_MISMATCH') return new FileError('SIZE_MISMATCH')
    if (code === 'FILE_HASH_MISMATCH') return new FileError('HASH_MISMATCH')
    if (code === 'UPLOAD_EXPIRED') return new FileError('EXPIRED')
    if (error.status === 409) return new FileError('CONFLICT')
    if (error.status === 400 || error.status === 415) return new FileError('INVALID_INPUT')
    if (error.status === 0 || error.status >= 500) return new FileError('UNAVAILABLE')
  }
  if (isRead || error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) return new FileError('UNAVAILABLE')
  return toApplicationDefect('files.operation', error)
}
