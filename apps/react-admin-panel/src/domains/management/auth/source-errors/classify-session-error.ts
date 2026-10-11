import { getBackendAdminApiErrorAccessToken, isBackendAdminApiError } from 'infra/backend-admin-api'
import { toApplicationDefect } from 'shared/errors'
import { hasOwn, isRecord } from 'shared/value-predicates'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import { rejectAuthentication } from '../operations/clear-authentication.operation'

/**
 * Различает пароль входа, отказ проверки текущего пароля и terminal 401 Bearer-сессии.
 */
export const classifySessionError = (error: unknown, isProtected = false): Error => {
  if (isBackendAdminApiError(error)) {
    if (error.status === 401) {
      if (
        isProtected && isRecord(error.error) && hasOwn(error.error, 'code') &&
        error.error.code === 'CURRENT_PASSWORD_INVALID'
      ) {
        return createAuthError(AUTH_ERROR_CODE.REQUEST_REJECTED)
      }
      if (isProtected) {
        rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
      }
      return createAuthError(isProtected ? AUTH_ERROR_CODE.SESSION_EXPIRED : AUTH_ERROR_CODE.INVALID_CREDENTIALS)
    }

    if (error.status === 429) {
      return createAuthError(AUTH_ERROR_CODE.RATE_LIMITED)
    }

    if (error.status === 400 || error.status === 403 || error.status === 409) {
      return createAuthError(AUTH_ERROR_CODE.REQUEST_REJECTED)
    }

    if (error.status >= 500) {
      return createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
    }
  }

  if (error instanceof TypeError || error instanceof DOMException) {
    return createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
  }

  return toApplicationDefect(isProtected ? 'auth.account' : 'auth.signIn', error)
}
