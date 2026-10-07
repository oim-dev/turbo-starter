import { hasOwn, isRecord } from 'shared/lib/value-predicates'
import type { ApiCredential } from '../types/api-session.type'

/**
 * Проверяет ответ API и привязку JWT к сессии для клиентской изоляции запросов.
 * Проверку подписи и авторизацию выполняет backend, а не этот декодер.
 */
export const readApiCredential = (input: unknown, scope: string): ApiCredential => {
  if (!isRecord(input) || !hasOwn(input, 'accessToken') || typeof input.accessToken !== 'string' ||
    !hasOwn(input, 'expiresIn') || typeof input.expiresIn !== 'number' || !Number.isInteger(input.expiresIn) ||
    input.expiresIn <= 0 || !hasOwn(input, 'tokenType') || input.tokenType !== 'Bearer') {
    throw new TypeError('Invalid access credential response')
  }
  const payload = input.accessToken.split('.')[1]
  if (!payload) throw new TypeError('Missing access credential claims')
  const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  if (!isRecord(claims) || !hasOwn(claims, 'sub') || typeof claims.sub !== 'string' || claims.sub === '' ||
    !hasOwn(claims, 'sid') || typeof claims.sid !== 'string' || claims.sid === '' ||
    !hasOwn(claims, 'exp') || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    throw new TypeError('Invalid access credential claims')
  }
  const expiresAt = Math.min(claims.exp * 1000, Date.now() + input.expiresIn * 1000)
  return {
    accessToken: input.accessToken,
    subject: claims.sub,
    sessionId: claims.sid,
    refreshAt: expiresAt - Math.min(30000, input.expiresIn * 100),
    scope
  }
}
