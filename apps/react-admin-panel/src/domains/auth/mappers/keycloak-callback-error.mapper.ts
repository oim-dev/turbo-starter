import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import type { AuthError } from '../errors/auth.error'

/**
 * Преобразует только известные публичные коды возврата, не раскрывая raw provider payload.
 */
export const mapKeycloakCallbackError = (error: string | null): AuthError => {
  switch (error) {
    case 'keycloak_unavailable':
      return createAuthError(AUTH_ERROR_CODE.KEYCLOAK_UNAVAILABLE)
    case 'keycloak_denied':
      return createAuthError(AUTH_ERROR_CODE.KEYCLOAK_DENIED)
    default:
      return createAuthError(AUTH_ERROR_CODE.KEYCLOAK_INVALID)
  }
}
