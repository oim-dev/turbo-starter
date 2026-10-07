import { isBackendAdminApiError } from './is-backend-admin-api-error'

/**
 * Префикс HTTP-схемы Bearer, регистр которой не имеет значения.
 */
const BEARER_PREFIX = 'Bearer '

/**
 * Возвращает Bearer фактически отклонённого запроса, независимо от текущего токена клиента.
 */
export const getBackendAdminApiErrorAccessToken = (error: unknown): string | null => {
  if (!isBackendAdminApiError(error)) {
    return null
  }

  const authorization = new Headers(error.request.headers).get('Authorization')
  if (authorization === null || !authorization.toLowerCase().startsWith(BEARER_PREFIX.toLowerCase())) {
    return null
  }

  const accessToken = authorization.slice(BEARER_PREFIX.length).trim()

  return accessToken.length === 0 ? null : accessToken
}
