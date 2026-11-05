import type { ResponseFormat } from '@oim/admin-rest-api-sdk/http-client'

/**
 * Сохраняет JSON ошибки даже для void-операций; успешные ответы читает в формате SDK.
 */
export const parseResponse = async (response: Response, format?: ResponseFormat): Promise<unknown> => {
  if (response.status === 204 || response.status === 205) {
    return undefined
  }

  const mediaType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
  const isJson = mediaType === 'application/json' || mediaType?.endsWith('+json') === true
  if (!response.ok && isJson) {
    return response.json()
  }
  if (format === undefined) {
    return undefined
  }

  return response[format]()
}
