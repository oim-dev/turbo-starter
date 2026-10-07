import type { ComponentPropsWithoutRef } from 'react'

/** Данные и действия меню сотрудника. */
export type AccountMenuParams = {
  /** Логин из текущей административной сессии. */
  userLogin: string | null
  /** Запускает завершение сеанса и обработку его результата. */
  onLogout: () => Promise<void>
}

/** Атрибуты кнопки открытия меню. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'type' | 'onClick' | 'aria-label'>

/** Свойства меню текущего сотрудника. */
export type AccountMenuProps = RootAttrs & AccountMenuParams
