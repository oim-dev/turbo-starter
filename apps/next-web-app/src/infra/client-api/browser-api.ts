import { createApiClient } from '@oim/client-rest-api-sdk/create-api-client'
import { HttpClient } from '@oim/client-rest-api-sdk/http-client'
import { clientAuthRegister } from '@oim/client-rest-api-sdk/operations/client-auth-register'
import { clientBrowserLogin } from '@oim/client-rest-api-sdk/operations/client-browser-login'
import { clientBrowserLogout } from '@oim/client-rest-api-sdk/operations/client-browser-logout'
import { getClientUserProfile } from '@oim/client-rest-api-sdk/operations/get-client-user-profile'
import { updateClientUserProfile } from '@oim/client-rest-api-sdk/operations/update-client-user-profile'
import { changeClientUserLogin } from '@oim/client-rest-api-sdk/operations/change-client-user-login'
import { changeClientUserPassword } from '@oim/client-rest-api-sdk/operations/change-client-user-password'
import { authorizeRequest } from './helpers/authorize-request'
import { handleApiError } from './helpers/handle-api-error'
import { parseApiResponse } from './helpers/parse-api-response'
import { validateSessionResponse } from './helpers/validate-session-response'

/**
 * Один браузерный Bearer-транспорт без cookies и автоматического повтора запросов.
 */
export const httpClient: HttpClient = new HttpClient({
  baseUrl: (process.env.NEXT_PUBLIC_CLIENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  credentials: 'omit',
  cache: 'no-store',
  timeout: 12_000,
  headers: {
    'X-CSRF-Protection': '1'
  },
  responseParser: parseApiResponse,
  onRequest: authorizeRequest,
  onResponse: validateSessionResponse,
  onError: handleApiError
})

/** Прямой браузерный SDK-клиент; его создание не обращается к browser API. */
export const clientApi = createApiClient(httpClient, {
  auth: {
    register: clientAuthRegister,
    login: clientBrowserLogin,
    logout: clientBrowserLogout
  },
  users: {
    getProfile: getClientUserProfile,
    updateProfile: updateClientUserProfile,
    changeLogin: changeClientUserLogin,
    changePassword: changeClientUserPassword
  }
})
