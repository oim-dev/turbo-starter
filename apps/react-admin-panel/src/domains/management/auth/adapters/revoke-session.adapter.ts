import { isBackendAdminApiError, revokeBackendAdminApiCredential } from 'infra/backend-admin-api'
import { toApplicationDefect } from 'shared/errors'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'

/**
 * Отзывает серверную сессию; потерянный ответ не считается подтверждением выхода.
 */
export const revokeSession = async (accessToken: string): Promise<void> => {
  try {
    await revokeBackendAdminApiCredential(accessToken)
  } catch (error) {
    if (isBackendAdminApiError(error) && error.status === 401) {
      return
    }
    if (isBackendAdminApiError(error) || error instanceof TypeError || error instanceof DOMException) {
      throw createAuthError(AUTH_ERROR_CODE.LOGOUT_INCOMPLETE)
    }

    throw toApplicationDefect('auth.logout', error)
  }
}
