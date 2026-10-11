import type { ComponentPropsWithoutRef } from 'react'
import type { AccessRole, ManagedAccount } from 'domains/admin-access'

/**
 * Данные списка пользователей административной панели.
 */
export type UsersListParams = {
  /**
   * Доступные владельцу аккаунты.
   */
  accounts: ManagedAccount[]
  /**
   * Каталог ролей для подписей и фильтра.
   */
  roles: AccessRole[]
  /**
   * Собственный аккаунт для отметки «Вы».
   */
  currentUserId?: string
}

/**
 * Атрибуты корневой области списка.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства списка пользователей.
 */
export type UsersListProps = RootAttrs & UsersListParams
