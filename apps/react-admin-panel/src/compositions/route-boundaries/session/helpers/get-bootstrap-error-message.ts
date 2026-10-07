import type { AuthError } from 'domains/auth'

/**
 * Локализует причину неподтверждённой сессии без технических сообщений источника.
 */
export const getBootstrapErrorMessage = (error: AuthError | null): string => {
  switch (error?.code) {
    case 'REFRESH_UNCERTAIN':
      return 'Не удалось безопасно восстановить сеанс. Войдите заново.'
    case 'UNSUPPORTED_BROWSER':
      return 'Для безопасного входа откройте панель по HTTPS в современном браузере.'
    case 'RATE_LIMITED':
      return 'Слишком много запросов. Подождите немного и повторите проверку.'
    case 'INVALID_CREDENTIALS':
    case 'SESSION_EXPIRED':
      return 'Сеанс больше не действителен. Войдите заново.'
    case 'REQUEST_REJECTED':
      return 'Сервер не подтвердил доступ. Повторите проверку или обратитесь к администратору.'
    case 'LOGOUT_INCOMPLETE':
      return 'Вы вышли на этом устройстве, но завершение сеанса на сервере не подтверждено.'
    case 'UNAVAILABLE':
    case 'SUPERSEDED':
    case undefined:
      return 'Не удалось проверить сеанс. Проверьте подключение и повторите попытку.'
  }
}
