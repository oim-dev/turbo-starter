import type { ComponentPropsWithoutRef } from 'react'
import type { AdminNavigationItem } from '../ui/admin-sidebar'

/**
 * Настройка навигации общего административного каркаса.
 */
export type AdminLayoutParams = {
  /**
   * Меню альтернативного layout; по умолчанию используется обычная навигация.
   */
  navigationItems?: readonly AdminNavigationItem[]
}

/**
 * Атрибуты корневого каркаса, содержимым которого управляет роутер.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства обычного layout и его публичного контракта настройки сайдбара.
 */
export type AdminLayoutProps = RootAttrs & AdminLayoutParams
