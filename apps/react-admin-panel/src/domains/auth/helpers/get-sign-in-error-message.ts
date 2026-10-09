import type { AuthError } from '../errors/auth.error'

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
    case 'LOGOUT_INCOMPLETE':
      return 'Вы вышли на этом устройстве, но завершение сеанса на сервере не подтверждено.'
    case 'UNSUPPORTED_BROWSER':
      return 'Для безопасного входа откройте панель по HTTPS в современном браузере.'
    case 'SUPERSEDED':
      return 'Состояние сеанса изменилось. Повторите вход.'
    case 'KEYCLOAK_UNAVAILABLE':
      return 'Вход через Keycloak временно недоступен. Начните вход заново позже или используйте логин и пароль.'
    case 'KEYCLOAK_DENIED':
      return 'Вход через Keycloak отклонён или отменён. Для доступа нужна заранее привязанная учётная запись администратора.'
    case 'KEYCLOAK_INVALID':
      return 'Результат входа недействителен, истёк или уже использован. Начните вход заново.'
    case 'KEYCLOAK_UNCERTAIN':
      return 'Не удалось подтвердить завершение входа. В целях безопасности повтор не выполняется. Начните вход заново.'
  }
}
