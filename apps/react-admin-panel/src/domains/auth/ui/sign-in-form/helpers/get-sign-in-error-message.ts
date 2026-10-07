import type { AuthError } from '../../../errors/auth.error'

/**
 * Локализует публичные исходы входа и завершения сеанса.
 */
export const getSignInErrorMessage = (error: AuthError): string => {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Неверный логин или пароль.'
    case 'SESSION_EXPIRED':
      return 'Сеанс завершён. Войдите заново.'
    case 'REQUEST_REJECTED':
      return 'Вход отклонён. Проверьте данные или обратитесь к администратору.'
    case 'RATE_LIMITED':
      return 'Слишком много попыток входа. Подождите немного и попробуйте снова.'
    case 'UNAVAILABLE':
      return 'Сервис временно недоступен. Проверьте подключение и повторите попытку.'
    case 'REFRESH_UNCERTAIN':
      return 'Не удалось безопасно восстановить сеанс. Войдите заново.'
    case 'LOGOUT_INCOMPLETE':
      return 'Вы вышли на этом устройстве, но завершение сеанса на сервере не подтверждено.'
    case 'UNSUPPORTED_BROWSER':
      return 'Для безопасного входа откройте панель по HTTPS в современном браузере.'
    case 'SUPERSEDED':
      return 'Состояние сеанса изменилось. Повторите вход.'
  }
}
