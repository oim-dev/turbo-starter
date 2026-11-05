import {
  backendAdminApi,
  getBackendAdminApiAccessToken,
  getBackendAdminApiErrorAccessToken,
  isBackendAdminApiError
} from 'infra/backend-admin-api'
import { AUTH_ERROR_CODE, createAuthError, isAuthError } from '../errors/auth.error'
import { mapCurrentUser } from '../mappers/current-user.mapper'
import { rejectAuthentication } from '../operations/clear-authentication.operation'
import type { CurrentUser } from '../types/current-user.type'

/**
 * Получает активного администратора, закрывая только актуальную отклонённую сессию.
 * Любой неуспешный GET имеет доменный контракт для стандартного канала ошибок SWR.
 */
export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const accessToken = getBackendAdminApiAccessToken()
  if (accessToken === null) {
    return null
  }

  try {
    const payload = await backendAdminApi.auth.adminAuthMe()
    if (getBackendAdminApiAccessToken() !== accessToken) {
      throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
    }

    return mapCurrentUser(payload)
  } catch (error) {
    if (isBackendAdminApiError(error)) {
      if (error.status === 401 || error.status === 404) {
        rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
        throw createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED)
      }

      if (error.status === 429) {
        throw createAuthError(AUTH_ERROR_CODE.RATE_LIMITED)
      }
    }

    if (isAuthError(error)) {
      if (error.code === AUTH_ERROR_CODE.SESSION_EXPIRED) {
        rejectAuthentication(accessToken)
      }

      throw error
    }

    throw createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
  }
}
