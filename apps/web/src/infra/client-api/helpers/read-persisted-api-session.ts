import { hasOwn, isRecord } from 'shared/lib/value-predicates'
import type { PersistedApiSession } from '../types/api-session.type'
import { readAccessClaims } from './read-access-claims'

/**
 * Валидирует недоверенную запись без пересчёта срока от текущего времени.
 */
export const readPersistedApiSession = (serialized: string): PersistedApiSession => {
  const input: unknown = JSON.parse(serialized)
  if (!isRecord(input) || !hasOwn(input, 'version') || input.version !== 1 ||
    !hasOwn(input, 'scope') || typeof input.scope !== 'string' ||
    !/^(active|guest):[0-9a-f-]{36}$/.test(input.scope) || !hasOwn(input, 'credential')) {
    throw new TypeError('Invalid persisted API session')
  }
  if (input.credential === null && input.scope.startsWith('guest:')) {
    return { version: 1, scope: input.scope, credential: null }
  }
  const stored = input.credential
  if (!input.scope.startsWith('active:') || !isRecord(stored) ||
    !hasOwn(stored, 'accessToken') || typeof stored.accessToken !== 'string' ||
    !hasOwn(stored, 'subject') || !hasOwn(stored, 'sessionId') ||
    !hasOwn(stored, 'scope') || stored.scope !== input.scope ||
    !hasOwn(stored, 'expiresAt') || typeof stored.expiresAt !== 'number' ||
    !Number.isSafeInteger(stored.expiresAt) || stored.expiresAt <= 0) {
    throw new TypeError('Invalid persisted API credential')
  }
  const claims = readAccessClaims(stored.accessToken)
  if (stored.subject !== claims.subject || stored.sessionId !== claims.sessionId ||
    stored.expiresAt > claims.expiresAt) {
    throw new TypeError('Persisted API credential does not match JWT')
  }
  return {
    version: 1,
    scope: input.scope,
    credential: {
      accessToken: stored.accessToken,
      subject: claims.subject,
      sessionId: claims.sessionId,
      expiresAt: stored.expiresAt,
      scope: input.scope
    }
  }
}
