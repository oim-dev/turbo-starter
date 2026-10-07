import { ApiError } from '@demo/admin-rest-api-sdk/http-client'

/**
 * Проверяет принадлежность ошибки HTTP-контракту административного SDK.
 */
export const isBackendAdminApiError = (error: unknown): error is ApiError<unknown> => {
  return error instanceof ApiError
}
