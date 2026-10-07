import { isNonEmptyString } from '@biocad/value-predicates'

const AUTH_BASE_URL = 'https://admin.local'
const DEFAULT_RETURN_TO = '/'

/**
 * Возвращает безопасный внутренний маршрут из query-параметра страницы входа.
 */
export const getAuthReturnTo = (search: string): string => {
  const requestedReturnTo = new URLSearchParams(search).get('returnTo')

  if (
    !isNonEmptyString(requestedReturnTo)
    || !requestedReturnTo.startsWith('/')
    || requestedReturnTo.startsWith('//')
    || requestedReturnTo.includes('\\')
  ) {
    return DEFAULT_RETURN_TO
  }

  try {
    const returnToUrl = new URL(requestedReturnTo, AUTH_BASE_URL)
    const normalizedReturnTo = `${returnToUrl.pathname}${returnToUrl.search}${returnToUrl.hash}`

    if (
      returnToUrl.origin !== AUTH_BASE_URL
      || !normalizedReturnTo.startsWith('/')
      || normalizedReturnTo.startsWith('//')
      || normalizedReturnTo.includes('\\')
    ) {
      return DEFAULT_RETURN_TO
    }

    return normalizedReturnTo
  } catch {
    return DEFAULT_RETURN_TO
  }
}
