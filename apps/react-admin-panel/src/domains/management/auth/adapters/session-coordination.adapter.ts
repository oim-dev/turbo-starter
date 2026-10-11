import { openBackendAdminApiCredentialCoordination } from 'infra/backend-admin-api'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'

/**
 * Подключает координацию persisted credential, не создавая второго хранилища сессии.
 */
export const openSessionCoordination = (
  onChange: () => void
): ReturnType<typeof openBackendAdminApiCredentialCoordination> => {
  try {
    return openBackendAdminApiCredentialCoordination(onChange)
  } catch {
    throw createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
  }
}
