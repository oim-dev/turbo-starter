import { ApiError } from '@oim/client-rest-api-sdk/http-client'
import type { RequestContext } from '@oim/client-rest-api-sdk/http-client'
import { hasOwn, isRecord } from 'shared/lib/value-predicates'
import { SessionChangedError } from '../errors/session-changed-error'
import { getApiSessionSnapshot, rejectApiCredential } from '../stores/api-session.store'
import { requestCredentialMap } from '../stores/request-credentials.store'
import { isCurrentSession } from './is-current-session'

/**
 * Удаляет отклонённый Bearer, но не более новую сессию. Исходную ошибку получает владелец lifecycle.
 * Транспорт не управляет доменным состоянием, навигацией или приватным кешем и не повторяет запрос.
 */
export const handleApiError = (error: unknown, context: RequestContext): never => {
  const expected = requestCredentialMap.get(context.request)
  if (!expected) throw error
  if (!isCurrentSession(expected)) throw new SessionChangedError()
  if (error instanceof ApiError && error.status === 401) {
    const problem: unknown = error.error
    // Неверный текущий пароль отклоняет операцию, а не действующий Bearer.
    if (isRecord(problem) && hasOwn(problem, 'code') && problem.code === 'CURRENT_PASSWORD_INVALID') throw error
    rejectApiCredential(expected.accessToken, getApiSessionSnapshot().version)
  }
  throw error
}
