import type { ApiRequestClient, FullRequestParams } from '@demo/client-rest-api-sdk/http-client'
import { SessionChangedError } from '../errors/session-changed-error'
import { SessionRefreshError } from '../errors/session-refresh-error'
import { requestCredentialMap } from '../stores/request-credentials.store'
import { getReadyApiCredential } from './get-ready-api-credential'

/**
 * Добавляет актуальный Bearer только к приватным операциям, исключая cookie-auth endpoints.
 */
export const authorizeRequest = async (
  httpClient: ApiRequestClient,
  request: FullRequestParams
): Promise<FullRequestParams> => {
  if (typeof window === 'undefined') throw new TypeError('Browser Client API cannot run during SSR')
  if (!request.secure || request.path.startsWith('/auth/')) return request
  const current = await getReadyApiCredential(httpClient)
  if (!current) throw new SessionRefreshError()
  const headers = new Headers(request.headers)
  const authorization = `Bearer ${current.accessToken}`
  if (headers.has('Authorization') && headers.get('Authorization') !== authorization) throw new SessionChangedError()
  headers.set('Authorization', authorization)
  const authenticatedRequest = { ...request, headers }
  requestCredentialMap.set(authenticatedRequest, current)
  return authenticatedRequest
}
