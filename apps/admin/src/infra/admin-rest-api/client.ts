import { ApiError, HttpClient } from '@biocad/admin-rest-api-sdk'

import {
  ADMIN_REST_API_BASE_URL,
  ADMIN_REST_API_TIMEOUT_MS
} from './config/admin-rest-api.config'
import { addCsrfHeader } from './lib/add-csrf-header'
import { adminRestApiFetch } from './lib/admin-rest-api-fetch'
import { clearAdminRestApiCsrfToken } from './admin-rest-api-csrf'
import { emitAdminRestApiUnauthorized } from './admin-rest-api-session'

/** Транспортный HTTP-клиент Admin REST API. */
export const adminHttpClient = new HttpClient({
  baseUrl: ADMIN_REST_API_BASE_URL,
  credentials: 'same-origin',
  customFetch: adminRestApiFetch,
  timeout: ADMIN_REST_API_TIMEOUT_MS,
  onRequest: (params) => {
    return addCsrfHeader(params)
  },
  onError: (error) => {
    if (error instanceof ApiError && error.status === 401) {
      clearAdminRestApiCsrfToken()
      emitAdminRestApiUnauthorized()
    }

    throw error
  }
})
