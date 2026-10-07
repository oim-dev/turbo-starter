import type { FullRequestParams } from '@biocad/admin-rest-api-sdk'
import { isNonEmptyString } from '@biocad/value-predicates'

import { getAdminRestApiCsrfToken } from '../admin-rest-api-csrf'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Добавляет CSRF header к изменяющим запросам Admin REST API.
 */
export const addCsrfHeader = (request: FullRequestParams): FullRequestParams => {
  const method = request.method?.toUpperCase() ?? 'GET'
  const csrfToken = getAdminRestApiCsrfToken()

  if (SAFE_METHODS.has(method) || !isNonEmptyString(csrfToken)) {
    return request
  }

  const headers = new Headers(request.headers)

  if (headers.has('X-CSRF-Token')) {
    return request
  }

  headers.set('X-CSRF-Token', csrfToken)

  return {
    ...request,
    headers
  }
}
