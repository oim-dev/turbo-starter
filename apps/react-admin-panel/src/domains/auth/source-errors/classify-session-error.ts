import { isBackendAdminApiError } from 'infra/backend-admin-api'
import { toApplicationDefect } from 'shared/errors'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'

/**
 * Интерпретирует отказ источника с учётом одноразового обмена refresh cookie.
 */
export const classifySessionError = (error: unknown, isRefresh: boolean): Error => {
  if (isBackendAdminApiError(error)) {
    if (error.status === 401) {
      return createAuthError(isRefresh ? AUTH_ERROR_CODE.SESSION_EXPIRED : AUTH_ERROR_CODE.INVALID_CREDENTIALS)
    }

    if (error.status === 429) {
      return createAuthError(AUTH_ERROR_CODE.RATE_LIMITED)
    }

    if (error.status === 400 || error.status === 403) {
      return createAuthError(AUTH_ERROR_CODE.REQUEST_REJECTED)
    }

    if (error.status >= 500) {
      return createAuthError(isRefresh ? AUTH_ERROR_CODE.REFRESH_UNCERTAIN : AUTH_ERROR_CODE.UNAVAILABLE)
    }
  }

  if (error instanceof TypeError || error instanceof DOMException) {
    return createAuthError(isRefresh ? AUTH_ERROR_CODE.REFRESH_UNCERTAIN : AUTH_ERROR_CODE.UNAVAILABLE)
  }

  return toApplicationDefect(isRefresh ? 'auth.refresh' : 'auth.signIn', error)
}
