import type { ResponseFormat } from '@demo/admin-rest-api-sdk/http-client'

/**
 * Читает ответ в формате операции; ответы без тела возвращает как undefined.
 */
export const parseResponse = async (response: Response, format?: ResponseFormat): Promise<unknown> => {
  if (response.status === 204 || response.status === 205 || format === undefined) {
    return undefined
  }

  return response[format]()
}
