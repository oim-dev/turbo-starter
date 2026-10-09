import { rejectAuthentication } from 'domains/auth'
import { getBackendAdminApiErrorAccessToken, isBackendAdminApiError } from 'infra/backend-admin-api'
import { toApplicationDefect } from 'shared/errors'

/**
 * Предусмотренный отказ управления доступом без деталей транспорта.
 */
export class AccessError extends Error {}

/**
 * Переводит отказ записи в безопасный предметный исход.
 */
export const classifyAccessError = (error: unknown): Error => {
  if (isBackendAdminApiError(error)) {
    if (error.status === 401) {
      rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
      return new AccessError('Сессия завершена. Войдите снова.')
    }
    if (error.status === 403) return new AccessError('Управление доступом разрешено только владельцу.')
    if (error.status === 409) return new AccessError('Конфликт: данные изменены, логин или привязка заняты либо роль используется. Последнего владельца нельзя отключить или понизить.')
    if (error.status === 400) return new AccessError('Операция недопустима. Проверьте данные и права роли. У активного аккаунта должен оставаться хотя бы один способ входа.')
    if (error.status === 404) return new AccessError('Запись больше не существует. Обновите список.')
    if (error.status === 429) return new AccessError('Слишком много запросов. Попробуйте позже.')
    if (error.status >= 500) return new AccessError('Сервис недоступен. Обновите список перед следующим изменением.')
  }
  return toApplicationDefect('admin-access.write', error)
}
