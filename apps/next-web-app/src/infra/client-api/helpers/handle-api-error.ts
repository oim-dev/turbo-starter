import { ApiError } from '@demo/client-rest-api-sdk/http-client'
import type { ApiRequestClient, RequestContext } from '@demo/client-rest-api-sdk/http-client'
import { SessionChangedError } from '../errors/session-changed-error'
import { SessionRetryRequiredError } from '../errors/session-retry-required-error'
import { requestCredentialMap } from '../stores/request-credentials.store'
import { isCurrentSession } from './is-current-session'
import { refreshApiSession } from './refresh-api-session'

/**
 * Однократно обновляет отклонённый токен; автоматически повторяет только безопасные чтения.
 */
export const handleApiError = async <T>(
  httpClient: ApiRequestClient,
  error: unknown,
  context: RequestContext<T>
): Promise<T> => {
  const expected = requestCredentialMap.get(context.request)
  if (!(error instanceof ApiError) || error.status !== 401 || !expected || context.retryCount !== 0) throw error
  if (!isCurrentSession(expected)) throw new SessionChangedError()
  const refreshed = await refreshApiSession(httpClient, expected)
  if (!refreshed || !isCurrentSession(refreshed)) throw error
  const canRetry = ['GET', 'HEAD', 'OPTIONS'].includes(context.request.method ?? 'GET')
  if (!canRetry) throw new SessionRetryRequiredError()
  return context.retry()
}
