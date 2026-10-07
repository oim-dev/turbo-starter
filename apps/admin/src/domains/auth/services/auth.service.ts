import {
  adminRestApi,
  clearAdminRestApiCsrfToken,
  setAdminRestApiCsrfToken
} from 'infra/admin-rest-api'

import {
  mapAuthCsrfResponse,
  mapAuthLogoutResponse,
  mapAuthSessionResponse
} from '../mappers/auth-response.mapper'
import type { AuthSession } from '../types/auth-session.type'

/**
 * Получает BFF-сессию и подготавливает CSRF transport state.
 */
export const resolveAuthSession = async (signal: AbortSignal): Promise<AuthSession | null> => {
  clearAdminRestApiCsrfToken()

  const sessionResponse: unknown = await adminRestApi.auth.getAdminSession({ signal })
  const session = mapAuthSessionResponse(sessionResponse)

  if (session === null) {
    return null
  }

  const csrfResponse: unknown = await adminRestApi.auth.getAdminCsrfToken({ signal })
  const csrfToken = mapAuthCsrfResponse(csrfResponse)

  setAdminRestApiCsrfToken(csrfToken)
  return session
}

/**
 * Начинает redirect-based вход через BFF.
 */
export const startAuthLogin = (returnTo: string): void => {
  const query = new URLSearchParams({ returnTo })
  window.location.assign(`/api/auth/login?${query.toString()}`)
}

/**
 * Завершает BFF-сессию и возвращает URL выхода из Keycloak.
 */
export const logoutAuthSession = async (signal: AbortSignal): Promise<string> => {
  const logoutResponse: unknown = await adminRestApi.auth.logoutAdminSession({ signal })
  const redirectUrl = mapAuthLogoutResponse(logoutResponse)

  clearAdminRestApiCsrfToken()
  return redirectUrl
}

/**
 * Открывает подтверждённый BFF URL завершения OIDC-сессии.
 */
export const completeAuthLogout = (redirectUrl: string): void => {
  window.location.assign(redirectUrl)
}
