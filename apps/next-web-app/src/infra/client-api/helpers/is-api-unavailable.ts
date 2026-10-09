import { ApiError } from '@oim/client-rest-api-sdk/http-client'

/**
 * Распознаёт временную недоступность транспорта без маскировки ошибок преобразования данных.
 */
export const isApiUnavailable = (error: unknown): boolean => {
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500
  if (error instanceof DOMException) return ['TimeoutError', 'AbortError'].includes(error.name)
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message)
}
