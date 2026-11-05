import { BACKEND_ADMIN_API_BASE_URL } from './config/backend-admin-api.config'

/**
 * Строит адрес навигационного endpoint; его нельзя запрашивать через redirect:error HttpClient.
 */
export const getBackendKeycloakLoginUrl = (returnTo: string): string => {
  return `${BACKEND_ADMIN_API_BASE_URL}/auth/keycloak/login?${new URLSearchParams({ returnTo })}`
}
