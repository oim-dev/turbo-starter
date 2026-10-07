import { createApiClient } from '@demo/client-rest-api-sdk/create-api-client'
import { HttpClient } from '@demo/client-rest-api-sdk/http-client'
import { clientAuthRegister } from '@demo/client-rest-api-sdk/operations/client-auth-register'
import { clientBrowserLogin } from '@demo/client-rest-api-sdk/operations/client-browser-login'
import { clientBrowserLogout } from '@demo/client-rest-api-sdk/operations/client-browser-logout'
import { clientBrowserRefresh } from '@demo/client-rest-api-sdk/operations/client-browser-refresh'
import { getClientUserProfile } from '@demo/client-rest-api-sdk/operations/get-client-user-profile'
import { updateClientUserProfile } from '@demo/client-rest-api-sdk/operations/update-client-user-profile'
import { changeClientUserLogin } from '@demo/client-rest-api-sdk/operations/change-client-user-login'
import { changeClientUserPassword } from '@demo/client-rest-api-sdk/operations/change-client-user-password'
import { authorizeRequest } from './helpers/authorize-request'
import { handleApiError } from './helpers/handle-api-error'
import { validateSessionResponse } from './helpers/validate-session-response'

/** Один браузерный транспорт для запросов API и обмена refresh-cookie. */
export const httpClient: HttpClient = new HttpClient({
  baseUrl: (process.env.NEXT_PUBLIC_CLIENT_API_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  credentials: 'include',
  cache: 'no-store',
  timeout: 12_000,
  headers: {
    'X-CSRF-Protection': '1'
  },
  onRequest: (request) => authorizeRequest(httpClient, request),
  onResponse: validateSessionResponse,
  onError: (error, context) => handleApiError(httpClient, error, context)
})

/** Прямой браузерный SDK-клиент; его создание не обращается к browser API. */
export const clientApi = createApiClient(httpClient, {
  auth: {
    register: clientAuthRegister,
    login: clientBrowserLogin,
    refresh: clientBrowserRefresh,
    logout: clientBrowserLogout
  },
  users: {
    getProfile: getClientUserProfile,
    updateProfile: updateClientUserProfile,
    changeLogin: changeClientUserLogin,
    changePassword: changeClientUserPassword
  }
})
