import { operationsTree } from '@oim/admin-rest-api-sdk'
import { createApiClient } from '@oim/admin-rest-api-sdk/create-api-client'
import { HttpClient } from '@oim/admin-rest-api-sdk/http-client'
import { BACKEND_ADMIN_API_BASE_URL } from './config/backend-admin-api.config'
import { authorizeRequest } from './helpers/authorize-request'
import { parseResponse } from './helpers/parse-response'

const httpClient = new HttpClient({
  baseUrl: BACKEND_ADMIN_API_BASE_URL,
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

/**
 * Отправляет ранее захваченный Bearer после локальной очистки, не подменяя его новым входом.
 */
export const revokeBackendAdminApiCredential = (accessToken: string): Promise<void> => {
  return backendAdminApi.auth.adminBrowserLogout({ headers: { Authorization: `Bearer ${accessToken}` } })
}
