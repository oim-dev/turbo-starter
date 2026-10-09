import { toApplicationDefect } from 'shared/errors'
import { hasOwn, isNumber, isRecord, isString } from 'shared/value-predicates'
import type { SessionCredentials } from '../types/session-credentials.type'

/**
 * Проверяет ответ входа и сохраняет абсолютную границу, не пересчитывая её при bootstrap.
 */
export const mapSessionCredentials = (payload: unknown, requestedAt: number): SessionCredentials => {
  if (
    !isRecord(payload) ||
    !hasOwn(payload, 'accessToken') || !isString(payload.accessToken) ||
    payload.accessToken.length === 0 || /\s/.test(payload.accessToken) ||
    !hasOwn(payload, 'tokenType') || payload.tokenType !== 'Bearer' ||
    !hasOwn(payload, 'expiresIn') || !isNumber(payload.expiresIn) || payload.expiresIn <= 0 ||
    !hasOwn(payload, 'sessionExpiresAt') || !isString(payload.sessionExpiresAt)
  ) {
    throw toApplicationDefect('auth.sessionCredentials', new Error('Invalid session response'))
  }

  const sessionExpiresAt = Date.parse(payload.sessionExpiresAt)
  const lifetime = payload.expiresIn * 1000
  const accessExpiresAt = Math.min(requestedAt + lifetime, sessionExpiresAt)

  if (!Number.isFinite(accessExpiresAt) || accessExpiresAt <= Date.now()) {
    throw toApplicationDefect('auth.sessionCredentials', new Error('Invalid session lifetime'))
  }

  return {
    accessToken: payload.accessToken,
    sessionExpiresAt: accessExpiresAt
  }
}
