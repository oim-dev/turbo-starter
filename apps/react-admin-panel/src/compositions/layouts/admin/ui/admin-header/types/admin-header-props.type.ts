import type { ComponentPropsWithoutRef } from 'react'

/** Данные пользователя и действия шапки. */
export type AdminHeaderParams = {
  /** Имя текущего сотрудника. */
  userLogin: string | null
  /** Состояние мобильной навигации. */
  isNavigationOpened: boolean
  /** Переключает мобильное меню. */
  onToggleNavigation: () => void
  /** Завершает административный сеанс. */
  onLogout: () => Promise<void>
}

/** Атрибуты внутренней области шапки. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/** Свойства шапки административного layout. */
export type AdminHeaderProps = RootAttrs & AdminHeaderParams
