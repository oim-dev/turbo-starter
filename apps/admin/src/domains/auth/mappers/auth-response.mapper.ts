import { hasOwn, isNonEmptyString, isRecord } from '@biocad/value-predicates'

import type { AuthSession } from '../types/auth-session.type'

/**
 * Преобразует ответ BFF в доменную административную сессию.
 */
export const mapAuthSessionResponse = (response: unknown): AuthSession | null => {
  if (response === null) {
    return null
  }

  if (
    !isRecord(response)
    || !hasOwn(response, 'user')
    || !isRecord(response.user)
    || !hasOwn(response.user, 'fullName')
    || !isNonEmptyString(response.user.fullName)
  ) {
    throw new TypeError('Admin session response has an invalid shape')
  }

  return { displayName: response.user.fullName.trim() }
}

/**
 * Извлекает CSRF token из проверенного ответа BFF.
 */
export const mapAuthCsrfResponse = (response: unknown): string => {
  if (!isRecord(response) || !hasOwn(response, 'csrfToken') || !isNonEmptyString(response.csrfToken)) {
    throw new TypeError('Admin CSRF response has an invalid shape')
  }

  return response.csrfToken
}

/**
 * Извлекает URL завершения OIDC-сессии из проверенного ответа BFF.
 */
export const mapAuthLogoutResponse = (response: unknown): string => {
  if (!isRecord(response) || !hasOwn(response, 'redirectUrl') || !isNonEmptyString(response.redirectUrl)) {
    throw new TypeError('Admin logout response has an invalid shape')
  }

  const redirectUrl = new URL(response.redirectUrl)

  if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
    throw new TypeError('Admin logout response has an invalid URL')
  }

  return redirectUrl.toString()
}
