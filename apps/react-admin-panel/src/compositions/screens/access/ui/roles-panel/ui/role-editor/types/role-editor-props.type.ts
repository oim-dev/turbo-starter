import type { AccessPermission, AccessRole } from 'domains/admin-access'

/**
 * Контракт редактирования одной роли.
 */
export type RoleEditorProps = {
  /**
   * Существующая роль либо создание новой.
   */
  role?: AccessRole
  /**
   * Каталог доступных действий.
   */
  permissions: AccessPermission[]
  /**
   * Завершение удаления выбранной роли.
   */
  onDeleted: () => void
}
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
