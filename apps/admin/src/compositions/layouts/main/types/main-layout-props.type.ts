import type { ComponentPropsWithoutRef } from 'react'

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Параметры основного layout панели администрирования.
 */
export type MainLayoutProps = RootAttrs
