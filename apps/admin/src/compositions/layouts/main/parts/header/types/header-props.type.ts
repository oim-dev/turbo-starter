import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры модуля Header.
 */
export type HeaderParams = {
  /** Открыта ли мобильная навигация. */
  isNavbarOpened: boolean
  /** Переключает мобильную навигацию. */
  onNavbarToggle: () => void
}

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'header'>, 'children'>

/**
 * Параметры верхней панели основного layout.
 */
export type HeaderProps = RootAttrs & HeaderParams
