import type { ApiRequestClient } from '@demo/client-rest-api-sdk/http-client'
import { SessionRefreshError } from '../errors/session-refresh-error'
import { assertApiBootstrap, peekApiCredential } from '../stores/api-session.store'
import type { ApiCredential } from '../types/api-session.type'
import { refreshApiSession } from './refresh-api-session'

/**
 * Получает готовый credential, обновляя истекающий токен тем же транспортом до отправки запроса.
 */
export const getReadyApiCredential = async (httpClient: ApiRequestClient): Promise<ApiCredential | null> => {
  const current = peekApiCredential()
  assertApiBootstrap()
  if (!current) return null
  if (current.refreshAt > Date.now()) return current
  const refreshed = await refreshApiSession(httpClient, current)
  if (!refreshed) throw new SessionRefreshError()
  return refreshed
}
