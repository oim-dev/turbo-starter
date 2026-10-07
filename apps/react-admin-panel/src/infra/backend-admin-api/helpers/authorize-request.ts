import type { FullRequestParams } from '@demo/admin-rest-api-sdk/http-client'
import { getBackendAdminApiAccessToken } from '../access-token-storage/access-token-storage'

/**
 * Пути браузерного обмена credential, для которых автоматически добавлять Bearer не требуется.
 * SDK сводит cookie- и Bearer-схемы OpenAPI к одному признаку secure.
 */
const COOKIE_EXCHANGE_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'] as const

/**
 * Добавляет актуальный Bearer к защищённому запросу, сохраняя явно заданную авторизацию.
 */
export const authorizeRequest = (request: FullRequestParams): FullRequestParams => {
  const isCookieExchange = COOKIE_EXCHANGE_PATHS.some((path) => path === request.path)
  if (request.secure !== true || isCookieExchange) {
    return request
  }

  const headers = new Headers(request.headers)
  if (headers.has('Authorization')) {
    return request
  }

  const accessToken = getBackendAdminApiAccessToken()
  if (accessToken === null) {
    return request
  }

  headers.set('Authorization', `Bearer ${accessToken}`)

  return { ...request, headers }
}
