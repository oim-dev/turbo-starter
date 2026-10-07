import type { GetCurrentUserError } from 'domains/auth'

/**
 * Выбирает безопасное пояснение отказа чтения профиля без технических деталей API.
 */
export const getProfileErrorMessage = (error: GetCurrentUserError | undefined): string => {
  if (error === undefined) {
    return 'Профиль пока недоступен. Повторите загрузку.'
  }

  switch (error.code) {
    case 'SESSION_EXPIRED':
      return 'Сеанс завершён. Войдите в панель заново.'
    case 'SUPERSEDED':
      return 'Сеанс изменился. Загрузите актуальный профиль.'
    case 'RATE_LIMITED':
      return 'Слишком много запросов. Подождите немного и повторите загрузку.'
    case 'UNAVAILABLE':
      return 'Сервис временно недоступен. Повторите загрузку позже.'
  }
}
