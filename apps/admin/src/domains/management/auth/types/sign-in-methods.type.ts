/**
 * Объявленные сервером способы входа администратора.
 */
export type SignInMethods = {
  /**
   * Доступен вход по локальным учётным данным.
   */
  readonly hasLocalSignIn: boolean
  /**
   * Настроен вход через корпоративного провайдера.
   */
  readonly hasKeycloakSignIn: boolean
}
