import { hasOwn, isRecord, isString } from 'shared/value-predicates'

/**
 * Возвращает только существующий приватный маршрут, сохраняя его query и hash.
 */
export const getSessionReturnTo = (state: unknown): string => {
  if (!isRecord(state) || !hasOwn(state, 'returnTo') || !isString(state.returnTo)) {
    return '/'
  }

  const returnTo = state.returnTo

  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\') || /\s/.test(returnTo)) {
    return '/'
  }

  try {
    const url = new URL(returnTo, 'https://admin.invalid')

    const isPrivateRoute =
      url.pathname === '/' ||
      /^\/profile\/?$/.test(url.pathname)
    if (url.origin !== 'https://admin.invalid' || !isPrivateRoute) {
      return '/'
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
