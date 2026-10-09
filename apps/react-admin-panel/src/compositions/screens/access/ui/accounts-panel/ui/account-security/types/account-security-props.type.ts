import type { ManagedAccount } from 'domains/admin-access'

/**
 * Выбранный аккаунт для управления способами входа.
 */
export type AccountSecurityProps = {
  /**
   * Снимок аккаунта и его активных привязок.
   */
  account: ManagedAccount
}

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
