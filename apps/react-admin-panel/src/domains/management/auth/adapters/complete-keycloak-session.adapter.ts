import { backendAdminApi, isBackendAdminApiError } from 'infra/backend-admin-api'
import { toApplicationDefect } from 'shared/errors'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import { mapSessionCredentials } from '../mappers/session-credentials.mapper'
import type { SessionCredentials } from '../types/session-credentials.type'

/**
 * Однократно обменивает HttpOnly completion cookie на новую административную сессию, без повторов.
 */
export const completeKeycloakSession = async (): Promise<SessionCredentials> => {
  const requestedAt = Date.now()
  const payload = await backendAdminApi.auth.adminKeycloakComplete().catch((error: unknown) => {
    if (isBackendAdminApiError(error)) {
      if (error.status === 400 || error.status === 401) {
        throw createAuthError(AUTH_ERROR_CODE.KEYCLOAK_INVALID)
      }
      if (error.status === 403) {
        throw createAuthError(AUTH_ERROR_CODE.KEYCLOAK_DENIED)
      }
      if (error.status === 429) {
        throw createAuthError(AUTH_ERROR_CODE.RATE_LIMITED)
      }
      if (error.status >= 500) {
        throw createAuthError(AUTH_ERROR_CODE.KEYCLOAK_UNCERTAIN)
      }
    }
    if (error instanceof TypeError || error instanceof DOMException) {
      throw createAuthError(AUTH_ERROR_CODE.KEYCLOAK_UNCERTAIN)
    }

    throw toApplicationDefect('auth.keycloakComplete', error)
  })

  return mapSessionCredentials(payload, requestedAt)
}
