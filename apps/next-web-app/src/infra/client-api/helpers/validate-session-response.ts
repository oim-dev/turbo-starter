import type { HttpResponse, RequestContext } from '@demo/client-rest-api-sdk/http-client'
import { SessionChangedError } from '../errors/session-changed-error'
import { requestCredentialMap } from '../stores/request-credentials.store'
import { isCurrentSession } from './is-current-session'

/**
 * Исключает попадание ответа предыдущего аккаунта в новый клиентский кеш.
 */
export const validateSessionResponse = <D, E>(
  response: HttpResponse<D, E>,
  context: RequestContext
): HttpResponse<D, E> => {
  const expected = requestCredentialMap.get(context.request)
  if (expected && !isCurrentSession(expected)) throw new SessionChangedError()
  return response
}
