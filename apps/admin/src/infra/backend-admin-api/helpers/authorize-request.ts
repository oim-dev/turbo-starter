import type { FullRequestParams } from '@oim/admin-rest-api-sdk/http-client'
import { getBackendAdminApiAccessToken } from '../access-token-storage/access-token-storage'

/**
 * Пути POST нового входа, для которых автоматически добавлять Bearer не требуется.
 * PUT /auth/login меняет логин действующего пользователя и требует Bearer.
 * SDK сводит cookie- и Bearer-схемы OpenAPI к одному признаку secure.
 */
const SIGN_IN_PATHS = ['/auth/login', '/auth/keycloak/complete'] as const

/**
 * Добавляет актуальный Bearer к защищённому запросу, сохраняя явно заданную авторизацию.
 */
export const authorizeRequest = (request: FullRequestParams): FullRequestParams => {
  const isSignIn = request.method === 'POST' && SIGN_IN_PATHS.some((path) => path === request.path)
  if (request.secure !== true || isSignIn) {
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
