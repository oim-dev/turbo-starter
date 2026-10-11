import type { KeycloakSettings } from 'domains/keycloak-settings'

/**
 * Исходные данные и завершение редактирования.
 */
export type KeycloakFormParams = {
  /**
   * Подтверждённые настройки без секрета.
   */
  settings: KeycloakSettings
}
/**
 * Свойства сценария настройки провайдера без собственного корневого DOM.
 */
export type KeycloakFormProps = KeycloakFormParams
/**
 * Пользовательский черновик конфигурации.
 */
export type KeycloakFormValues = {
  /**
   * Включение входа через провайдера.
   */
  enabled: boolean
  /**
   * Realm issuer.
   */
  issuer: string
  /**
   * Идентификатор OIDC client.
   */
  clientId: string
  /**
   * Новый secret; пустая строка сохраняет прежний.
   */
  clientSecret: string
  /**
   * Явное удаление прежнего секрета.
   */
  clearSecret: boolean
  /**
   * Адрес callback backend через публичный proxy.
   */
  callbackUrl: string
  /**
   * Адрес callback SPA.
   */
  frontendCallbackUrl: string
}
