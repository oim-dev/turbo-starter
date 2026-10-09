import { clearBackendAdminApiAccessToken, getBackendAdminApiAccessToken } from 'infra/backend-admin-api'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import type { AuthError } from '../errors/auth.error'
import { authStore } from '../stores/auth.store'

/**
 * Синхронно закрывает приватный интерфейс и отделяет кеш завершённой сессии.
 */
export const clearAuthentication = (error: AuthError | null = null): void => {
  try {
    clearBackendAdminApiAccessToken()
  } finally {
    authStore.getState().reset(error)
  }
}

/**
 * Завершает только ту локальную сессию, чей credential действительно отклонён.
 */
export const rejectAuthentication = (rejectedAccessToken: string | null): void => {
  if (rejectedAccessToken !== null && rejectedAccessToken === getBackendAdminApiAccessToken()) {
    clearAuthentication(createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED))
  }
}
