import { operationsTree } from '@demo/admin-rest-api-sdk'
import { createApiClient } from '@demo/admin-rest-api-sdk/create-api-client'
import { HttpClient } from '@demo/admin-rest-api-sdk/http-client'
import { authorizeRequest } from './helpers/authorize-request'
import { parseResponse } from './helpers/parse-response'

const httpClient = new HttpClient({
  baseUrl: '/api',
  credentials: 'include',
  referrerPolicy: 'strict-origin-when-cross-origin',
  redirect: 'error',
  cache: 'no-store',
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
    'X-CSRF-Protection': '1'
  },
  onRequest: authorizeRequest,
  responseParser: parseResponse
})

/**
 * Предоставляет полный административный API через единый браузерный HTTP-клиент.
 */
export const backendAdminApi = createApiClient(httpClient, operationsTree)
