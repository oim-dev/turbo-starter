import type { ComponentPropsWithoutRef } from 'react'

/**
 * Экран управления не требует собственных параметров.
 */
export type ManagementScreenParams = object

/**
 * Атрибуты корневой секции страницы управления.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства страницы управления.
 */
export type ManagementScreenProps = RootAttrs & ManagementScreenParams
