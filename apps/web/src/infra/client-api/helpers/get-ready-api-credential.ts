import { assertApiBootstrap, peekApiCredential } from '../stores/api-session.store'
import type { ApiCredential } from '../types/api-session.type'

/**
 * Читает проверенный credential, синхронно завершая истёкшую сессию без сетевого запроса.
 */
export const getReadyApiCredential = (): ApiCredential | null => {
  const current = peekApiCredential()
  assertApiBootstrap()
  return current
}
