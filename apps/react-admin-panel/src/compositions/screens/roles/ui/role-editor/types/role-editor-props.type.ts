import type { AccessPermission, AccessRole, ManagedAccount } from 'domains/admin-access'

/**
 * Контракт редактирования одной роли.
 */
export type RoleEditorParams = {
  /**
   * Существующая роль либо создание новой.
   */
  role?: AccessRole
  /**
   * Каталог доступных действий.
   */
  permissions: AccessPermission[]
  /**
   * Аккаунты, использующие роль.
   */
  accounts: ManagedAccount[]
}
/**
 * Свойства сценария редактирования роли.
 */
export type RoleEditorProps = RoleEditorParams
/**
 * Пользовательский ввод роли.
 */
export type RoleFormValues = {
  /**
   * Уникальный ключ.
   */
  key: string
  /**
   * Название роли.
   */
  name: string
  /**
   * Выбранные действия.
   */
  permissions: string[]
}
