import { backendAdminApi, isBackendAdminApiError } from 'infra/backend-admin-api'
import { toApplicationDefect } from 'shared/errors'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'

/**
 * Отзывает серверную сессию; потерянный ответ не считается подтверждением выхода.
 */
export const revokeSession = async (): Promise<void> => {
  try {
    await backendAdminApi.auth.adminBrowserLogout()
  } catch (error) {
    if (isBackendAdminApiError(error) || error instanceof TypeError || error instanceof DOMException) {
      throw createAuthError(AUTH_ERROR_CODE.LOGOUT_INCOMPLETE)
    }

    throw toApplicationDefect('auth.logout', error)
  }
}
