import type { ApiRequestClient } from '@oim/client-rest-api-sdk/http-client'
import { getClientUserProfile } from '@oim/client-rest-api-sdk/operations/get-client-user-profile'
import { hasOwn, isRecord } from 'shared/lib/value-predicates'
import { SessionChangedError } from '../errors/session-changed-error'
import { SessionRequiredError } from '../errors/session-required-error'
import {
  beginApiBootstrap,
  finishApiBootstrap,
  getApiSessionSnapshot,
  rejectApiCredential
} from '../stores/api-session.store'
import type { ApiCredential } from '../types/api-session.type'
import { isCurrentSession } from './is-current-session'

/**
 * Только параллельные проверки одного профиля; JWT не обновляется и запросы API не повторяются.
 */
const pendingChecks = new WeakMap<ApiCredential, Promise<ApiCredential>>()

/**
 * Проверяет сохранённый Bearer через профиль, не сохраняя пользовательские данные в infra или storage.
 */
const checkApiSessionProfile = async (httpClient: ApiRequestClient, current: ApiCredential): Promise<ApiCredential> => {
  if (!isCurrentSession(current)) throw new SessionChangedError()
  beginApiBootstrap()
  try {
    const profile: unknown = await getClientUserProfile(httpClient, {
      headers: { Authorization: `Bearer ${current.accessToken}` }
    })
    if (!isCurrentSession(current)) throw new SessionChangedError()
    if (!isRecord(profile) || !hasOwn(profile, 'id') || typeof profile.id !== 'string' ||
      !hasOwn(profile, 'isActive') || typeof profile.isActive !== 'boolean') {
      throw new TypeError('Invalid API session profile')
    }
    if (profile.id !== current.subject || !profile.isActive) {
      rejectApiCredential(current.accessToken, getApiSessionSnapshot().version)
      throw new SessionRequiredError()
    }
    finishApiBootstrap()
    return current
  } catch (error) {
    if (isCurrentSession(current)) finishApiBootstrap(error)
    throw error
  }
}

/**
 * Делит одну проверку между потребителями bootstrap, исключая гонку успешного и ошибочного результата.
 */
export const verifyApiSession = (httpClient: ApiRequestClient, current: ApiCredential): Promise<ApiCredential> => {
  const pending = pendingChecks.get(current)
  if (pending) return pending
  const promise = Promise.resolve()
    .then(() => checkApiSessionProfile(httpClient, current))
    .finally(() => pendingChecks.delete(current))
  pendingChecks.set(current, promise)
  return promise
}
