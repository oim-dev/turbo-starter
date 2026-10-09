/**
 * Управление переходом из предметной проекции способов входа.
 */
export type KeycloakSignInProps = {
  /**
   * Композиция выполняет обычную browser navigation, не fetch.
   */
  onContinue: () => void
  /**
   * Переход уже начат; повторная активация временно недоступна.
   */
  isRedirecting: boolean
}
