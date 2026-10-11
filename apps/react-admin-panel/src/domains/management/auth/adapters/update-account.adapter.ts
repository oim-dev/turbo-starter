import { backendAdminApi, getBackendAdminApiAccessToken } from 'infra/backend-admin-api'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import { classifySessionError } from '../source-errors/classify-session-error'

/**
 * Сохраняет отображаемое имя собственного аккаунта.
 */
export const updateAccountName = async (name: string): Promise<void> => {
  await backendAdminApi.auth.adminUpdateProfile({ name }).catch((error: unknown) => {
    throw classifySessionError(error, true)
  })
}

/**
 * Меняет логин; успешный ответ означает отзыв всех сессий аккаунта.
 */
export const changeAccountLogin = async (login: string, currentPassword?: string): Promise<void> => {
  const accessToken = getBackendAdminApiAccessToken()
  await backendAdminApi.auth.adminChangeLogin({ login, currentPassword }).catch((error: unknown) => {
    throw classifySessionError(error, true)
  })
  if (getBackendAdminApiAccessToken() !== accessToken) {
    throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
  }
}

/**
 * Меняет пароль и отзывает все сессии аккаунта.
 */
export const changeAccountPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const accessToken = getBackendAdminApiAccessToken()
  await backendAdminApi.auth.adminAuthChangePassword({ currentPassword, newPassword }).catch((error: unknown) => {
    throw classifySessionError(error, true)
  })
  if (getBackendAdminApiAccessToken() !== accessToken) {
    throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
  }
}
