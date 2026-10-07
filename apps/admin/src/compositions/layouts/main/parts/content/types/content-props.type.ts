import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры модуля Content.
 */
export type ContentParams = object

/** Атрибуты корневого элемента. */
type RootAttrs = ComponentPropsWithoutRef<'div'>

/**
 * Параметры основной области содержимого layout.
 */
export type ContentProps = RootAttrs & ContentParams
