import { getBackendKeycloakLoginUrl } from 'infra/backend-admin-api'
import { getSafeReturnTo } from 'shared/navigation'

/**
 * Предоставляет безопасный адрес начала входа; сам переход выполняет композиция.
 */
export const getKeycloakSignInUrl = (returnTo: string): string => {
  return getBackendKeycloakLoginUrl(getSafeReturnTo(returnTo))
}
