import type { FullRequestParams } from '@oim/client-rest-api-sdk/http-client'
import { SessionChangedError } from '../errors/session-changed-error'
import { SessionRequiredError } from '../errors/session-required-error'
import { peekApiCredential } from '../stores/api-session.store'
import { requestCredentialMap } from '../stores/request-credentials.store'
import { getReadyApiCredential } from './get-ready-api-credential'

/**
 * Добавляет Bearer приватным операциям. Bootstrap проверяет профиль, logout отзывает захваченный токен.
 */
export const authorizeRequest = (request: FullRequestParams): FullRequestParams => {
  if (typeof window === 'undefined') throw new TypeError('Browser Client API cannot run during SSR')
  const browserRequest = { ...request, credentials: 'omit' as const }
  if (!request.secure) return browserRequest
  const headers = new Headers(request.headers)
  // Локальная сессия уже очищена; нельзя заменить Bearer токеном более нового входа.
  if (request.path === '/auth/logout' && request.method === 'POST' && headers.has('Authorization')) {
    return browserRequest
  }
  const isProfileCheck = request.path === '/users/me' && request.method === 'GET' && headers.has('Authorization')
  const current = isProfileCheck ? peekApiCredential() : getReadyApiCredential()
  if (!current) throw new SessionRequiredError()
  const authorization = `Bearer ${current.accessToken}`
  if (headers.has('Authorization') && headers.get('Authorization') !== authorization) throw new SessionChangedError()
  headers.set('Authorization', authorization)
  const authenticatedRequest = { ...browserRequest, headers }
  requestCredentialMap.set(authenticatedRequest, current)
  return authenticatedRequest
}
