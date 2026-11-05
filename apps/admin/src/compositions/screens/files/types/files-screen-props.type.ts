import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры компонента Files.
 */
export type FilesScreenParams = object

/**
 * Атрибуты корневого элемента компонента Files.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства компонента Files.
 */
export type FilesScreenProps = RootAttrs & FilesScreenParams
