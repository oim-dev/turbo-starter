import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры модуля Sidebar.
 */
export type SidebarParams = {
  /** Закрывает мобильную навигацию после перехода. */
  onNavigate: () => void
}

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'nav'>, 'children'>

/**
 * Параметры боковой навигации.
 */
export type SidebarProps = RootAttrs & SidebarParams
