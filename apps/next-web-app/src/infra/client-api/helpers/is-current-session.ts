import { peekApiCredential } from '../stores/api-session.store'
import type { ApiCredential } from '../types/api-session.type'

/**
 * Проверяет, что ожидающий ответ всё ещё принадлежит текущей сессии.
 */
export const isCurrentSession = (expected: ApiCredential): boolean => {
  const current = peekApiCredential()
  return current !== null && current.scope === expected.scope && current.sessionId === expected.sessionId
}
