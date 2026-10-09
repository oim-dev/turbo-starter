import { hasOwn, isRecord } from 'shared/lib/value-predicates'
import { SessionRequiredError } from '../errors/session-required-error'
import type { ApiCredential } from '../types/api-session.type'
import { readAccessClaims } from './read-access-claims'

/**
 * Проверяет ответ API и привязку JWT к сессии для клиентской изоляции запросов.
 * Проверку подписи и авторизацию выполняет backend, а не этот декодер.
 */
export const readApiCredential = (input: unknown, scope: string): ApiCredential => {
  if (!isRecord(input) || !hasOwn(input, 'accessToken') || typeof input.accessToken !== 'string' ||
    !hasOwn(input, 'expiresIn') || typeof input.expiresIn !== 'number' || !Number.isSafeInteger(input.expiresIn) ||
    input.expiresIn <= 0 || !hasOwn(input, 'tokenType') || input.tokenType !== 'Bearer' ||
    !hasOwn(input, 'sessionExpiresAt') || typeof input.sessionExpiresAt !== 'string') {
    throw new TypeError('Invalid access credential response')
  }
  const sessionExpiresAt = Date.parse(input.sessionExpiresAt)
  if (!Number.isFinite(sessionExpiresAt)) throw new TypeError('Invalid session expiration')
  const claims = readAccessClaims(input.accessToken)
  const expiresAt = Math.min(claims.expiresAt, sessionExpiresAt, Date.now() + input.expiresIn * 1000)
  if (expiresAt <= Date.now()) throw new SessionRequiredError()
  return {
    accessToken: input.accessToken,
    subject: claims.subject,
    sessionId: claims.sessionId,
    expiresAt,
    scope
  }
}
