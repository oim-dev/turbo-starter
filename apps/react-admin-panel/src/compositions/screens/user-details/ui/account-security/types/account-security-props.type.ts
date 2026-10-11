import type { ManagedAccount } from 'domains/admin-access'

/**
 * Выбранный аккаунт для управления способами входа.
 */
export type AccountSecurityParams = {
  /**
   * Снимок аккаунта и его активных привязок.
   */
  account: ManagedAccount
}

/**
 * Свойства вкладки безопасности без собственного корневого DOM.
 */
export type AccountSecurityProps = AccountSecurityParams

/**
 * Ввод привязки пользователя Keycloak.
 */
export type IdentityFormValues = {
  /**
   * Точный issuer realm.
   */
  issuer: string
  /**
   * Неизменяемый sub пользователя.
   */
  subject: string
}

/**
 * Действие безопасности, ожидающее подтверждения пользователя.
 */
export type SecurityConfirmation = {
  /**
   * Название действия в диалоге.
   */
  title: string
  /**
   * Последствия подтверждения.
   */
  description: string
  /**
   * Операция, выполняемая только по подтверждению.
   */
  onConfirm: () => Promise<void>
}
