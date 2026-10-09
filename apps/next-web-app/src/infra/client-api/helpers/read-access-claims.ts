import { hasOwn, isRecord } from 'shared/lib/value-predicates'
import type { ApiCredential } from '../types/api-session.type'

/**
 * Читает только идентичность и срок JWT для изоляции запросов; подпись проверяет backend.
 */
export const readAccessClaims = (accessToken: string): Pick<ApiCredential, 'subject' | 'sessionId' | 'expiresAt'> => {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken)) {
    throw new TypeError('Invalid access credential encoding')
  }
  const payload = accessToken.split('.')[1]
  const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  if (!isRecord(claims) || !hasOwn(claims, 'sub') || typeof claims.sub !== 'string' || claims.sub === '' ||
    !hasOwn(claims, 'sid') || typeof claims.sid !== 'string' || claims.sid === '' ||
    !hasOwn(claims, 'exp') || typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) ||
    claims.exp <= 0 || !Number.isSafeInteger(claims.exp * 1000)) {
    throw new TypeError('Invalid access credential claims')
  }
  return { subject: claims.sub, sessionId: claims.sid, expiresAt: claims.exp * 1000 }
}
