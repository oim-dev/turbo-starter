import type { AccessRole, ManagedAccount } from 'domains/admin-access'

/**
 * Контракт формы аккаунта.
 */
export type AccountEditorProps = {
  /**
   * Существующий аккаунт либо создание нового.
   */
  account?: ManagedAccount
  /**
   * Доступные роли.
   */
  roles: AccessRole[]
}
/**
 * Пользовательский ввод создания или изменения аккаунта.
 */
export type AccountFormValues = {
  /**
   * Первоначальный логин.
   */
  login: string
  /**
   * Первоначальное имя.
   */
  name: string
  /**
   * Первоначальный пароль.
   */
  password: string
  /**
   * Назначаемая роль.
   */
  role: string
  /**
   * Активность существующего аккаунта.
   */
  isActive: boolean
}
