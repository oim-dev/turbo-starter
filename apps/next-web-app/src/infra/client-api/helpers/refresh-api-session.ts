import { ApiError } from '@demo/client-rest-api-sdk/http-client'
import type { ApiRequestClient } from '@demo/client-rest-api-sdk/http-client'
import { clientBrowserRefresh } from '@demo/client-rest-api-sdk/operations/client-browser-refresh'
import { REFRESH_PENDING_KEY } from '../config/api-session.config'
import { SessionChangedError } from '../errors/session-changed-error'
import { SessionRefreshError } from '../errors/session-refresh-error'
import {
  finishApiBootstrap,
  getApiRefreshFlight,
  getApiSessionSnapshot,
  peekApiCredential,
  setApiCredential,
  setApiRefreshFlight,
  syncApiSessionScope
} from '../stores/api-session.store'
import type { ApiCredential } from '../types/api-session.type'
import { readApiCredential } from './read-api-credential'
import { withSessionLock } from './with-session-lock'

/**
 * Обменивает refresh-cookie через переданный транспорт, разделяя результат между запросами вкладки.
 */
export const refreshApiSession = (
  httpClient: ApiRequestClient,
  expectedCredential: ApiCredential | null
): Promise<ApiCredential | null> => {
  const scope = syncApiSessionScope()
  const refreshFlight = getApiRefreshFlight()
  if (refreshFlight?.credential === expectedCredential && refreshFlight.scope === scope) return refreshFlight.promise
  const version = getApiSessionSnapshot().version
  const promise = withSessionLock(async () => {
    if (syncApiSessionScope() !== scope) throw new SessionChangedError()
    const current = peekApiCredential()
    if (current !== expectedCredential) throw new SessionChangedError()
    if (localStorage.getItem(REFRESH_PENDING_KEY)) throw new SessionRefreshError()
    localStorage.setItem(REFRESH_PENDING_KEY, '1')
    try {
      const response = await clientBrowserRefresh(httpClient)
      const refreshed = readApiCredential(response, scope)
      if (syncApiSessionScope() !== scope) throw new SessionChangedError()
      if (current && (current.sessionId !== refreshed.sessionId || current.subject !== refreshed.subject)) {
        throw new SessionChangedError()
      }
      localStorage.removeItem(REFRESH_PENDING_KEY)
      setApiCredential(refreshed)
      return refreshed
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem(REFRESH_PENDING_KEY)
        return null
      }
      if (error instanceof SessionChangedError) throw error
      throw new SessionRefreshError()
    }
  })
  setApiRefreshFlight({ credential: expectedCredential, scope, promise })
  if (expectedCredential === null) {
    void promise.then(
      () => {
        if (getApiSessionSnapshot().version === version) finishApiBootstrap()
      },
      (error: unknown) => {
        if (getApiSessionSnapshot().version === version) finishApiBootstrap(error)
      }
    )
  }
  return promise
}
