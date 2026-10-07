import { backendAdminApi } from 'infra/backend-admin-api'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import { mapSessionCredentials } from '../mappers/session-credentials.mapper'
import { classifySessionError } from '../source-errors/classify-session-error'
import type { SessionCredentials } from '../types/session-credentials.type'
import type { SignInInput } from '../types/sign-in-input.type'

/**
 * Создаёт серверную сессию по проверенным учётным данным администратора.
 */
export const startSession = async (input: SignInInput): Promise<SessionCredentials> => {
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(input.login) || input.password.length < 1 || input.password.length > 128) {
    throw createAuthError(AUTH_ERROR_CODE.REQUEST_REJECTED)
  }

  const requestedAt = Date.now()
  const payload = await backendAdminApi.auth.adminBrowserLogin({
    login: input.login.toLowerCase(),
    password: input.password
  }).catch((error: unknown) => {
    throw classifySessionError(error, false)
  })

  return mapSessionCredentials(payload, requestedAt)
}
