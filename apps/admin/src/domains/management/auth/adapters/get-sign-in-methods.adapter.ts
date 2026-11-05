import { backendAdminApi } from 'infra/backend-admin-api'
import { hasOwn, isRecord } from 'shared/value-predicates'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import type { SignInMethods } from '../types/sign-in-methods.type'

/**
 * Получает доступность методов входа; отказ не меняет текущую сессию и локальную форму.
 */
export const getSignInMethods = async (): Promise<SignInMethods> => {
  try {
    const payload: unknown = await backendAdminApi.auth.adminAuthProviders()
    if (
      !isRecord(payload) || !hasOwn(payload, 'local') || typeof payload.local !== 'boolean' ||
      !hasOwn(payload, 'keycloak') || typeof payload.keycloak !== 'boolean'
    ) {
      throw createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
    }

    return { hasLocalSignIn: payload.local, hasKeycloakSignIn: payload.keycloak }
  } catch {
    throw createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
  }
}
