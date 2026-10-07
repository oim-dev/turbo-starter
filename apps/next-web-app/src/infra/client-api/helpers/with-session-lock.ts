import { SESSION_LOCK } from '../config/api-session.config'
import { SessionRefreshError } from '../errors/session-refresh-error'

/**
 * Сериализует login, logout и ротацию cookies между вкладками.
 */
export const withSessionLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  if (!navigator.locks) throw new SessionRefreshError()
  return navigator.locks.request(SESSION_LOCK, operation)
}
