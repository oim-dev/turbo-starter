import type { LoginDto } from '@demo/client-rest-api-sdk/data-contracts'
import { clientApi, httpClient } from '../browser-api'
import { REFRESH_PENDING_KEY } from '../config/api-session.config'
import { SessionChangedError } from '../errors/session-changed-error'
import { getReadyApiCredential } from '../helpers/get-ready-api-credential'
import { readApiCredential } from '../helpers/read-api-credential'
import { refreshApiSession } from '../helpers/refresh-api-session'
import { withSessionLock } from '../helpers/with-session-lock'
import { replaceApiSession, setApiRefreshFlight, syncApiSessionScope } from '../stores/api-session.store'
import type { ApiCredential } from '../types/api-session.type'

/**
 * Восстанавливает сессию через общий браузерный транспорт вне рендеринга React.
 */
export const restoreApiSession = (expectedCredential: ApiCredential | null = null): Promise<ApiCredential | null> => {
  return refreshApiSession(httpClient, expectedCredential)
}

/**
 * Предоставляет потребителю готовый credential настроенного браузерного клиента.
 */
export const getApiCredential = (): Promise<ApiCredential | null> => getReadyApiCredential(httpClient)

/**
 * Устанавливает новый access-токен и начинает чистую область данных после входа.
 */
export const loginApiSession = (input: LoginDto): Promise<void> => withSessionLock(async () => {
  const response = await clientApi.auth.login(input)
  const nextCredential = readApiCredential(response, syncApiSessionScope())
  localStorage.removeItem(REFRESH_PENDING_KEY)
  setApiRefreshFlight(undefined)
  replaceApiSession(nextCredential)
})

/**
 * Отзывает именно текущую браузерную сессию; не выдаёт сетевой сбой за успешный выход.
 */
export const logoutApiSession = (): Promise<void> => {
  const scope = syncApiSessionScope()
  return withSessionLock(async () => {
    if (syncApiSessionScope() !== scope) throw new SessionChangedError()
    await clientApi.auth.logout()
    localStorage.removeItem(REFRESH_PENDING_KEY)
    setApiRefreshFlight(undefined)
    replaceApiSession(null)
  })
}
