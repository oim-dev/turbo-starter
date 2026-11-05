import { ApiError } from '@oim/client-rest-api-sdk/http-client'
import type { ApiRequestClient } from '@oim/client-rest-api-sdk/http-client'
import { clientBrowserLogout } from '@oim/client-rest-api-sdk/operations/client-browser-logout'

/**
 * Отзывает захваченный JWT без чтения или изменения локальной сессии, включая компенсацию позднего login.
 * Только 401 означает уже завершённый доступ; сетевой сбой и другие ошибки отзыва передаются вызывающему коду.
 */
export const revokeApiSession = async (httpClient: ApiRequestClient, accessToken: string): Promise<void> => {
  if (typeof accessToken !== 'string' || accessToken === '') throw new TypeError('Missing session token to revoke')
  try {
    await clientBrowserLogout(httpClient, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return
    throw error
  }
}
