import { isString } from 'shared/value-predicates'

/**
 * Нормализует недоверенный адрес и разрешает только существующие приватные маршруты панели.
 */
export const getSafeReturnTo = (returnTo: unknown): string => {
  if (!isString(returnTo)) {
    return '/'
  }

  try {
    const decoded = decodeURIComponent(returnTo)
    const hasControlCharacter = Array.from(decoded).some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || (code >= 127 && code <= 159)
    })
    if (
      !returnTo.startsWith('/') || returnTo.startsWith('//') || decoded.includes('\\') || hasControlCharacter
    ) {
      return '/'
    }

    const url = new URL(returnTo, 'https://admin.invalid')
    const decodedPathname = decodeURIComponent(url.pathname)
    if (
      decodedPathname.startsWith('//') || /\s/.test(decodedPathname) ||
      decodedPathname.includes('?') || decodedPathname.includes('#')
    ) {
      return '/'
    }

    const normalizedUrl = new URL(decodedPathname, 'https://admin.invalid')
    const isPrivateRoute = normalizedUrl.pathname === '/' || /^\/(?:profile|access|settings\/keycloak)\/?$/.test(normalizedUrl.pathname)
    if (url.origin !== 'https://admin.invalid' || normalizedUrl.origin !== 'https://admin.invalid' || !isPrivateRoute) {
      return '/'
    }

    return `${normalizedUrl.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
