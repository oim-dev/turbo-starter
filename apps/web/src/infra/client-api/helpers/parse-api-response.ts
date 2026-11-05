import type { ResponseFormat } from '@oim/client-rest-api-sdk/http-client'

/**
 * Читает структурированные JSON-ошибки даже у void-операций SDK, не разбирая пустой успешный ответ.
 */
export const parseApiResponse = async (response: Response, format?: ResponseFormat): Promise<unknown> => {
  if (response.status === 204) return null
  if (!response.ok && response.headers.get('content-type')?.includes('application/json')) return response.json()
  if (!format) return null
  return response[format]()
}
