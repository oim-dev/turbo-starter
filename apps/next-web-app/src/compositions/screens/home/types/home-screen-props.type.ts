import type { ComponentPropsWithoutRef } from 'react'

/**
 * Собственные параметры главного экрана.
 */
export type HomeScreenParams = object

/**
 * Атрибуты основного содержимого; дочерним деревом управляет экран.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Свойства главного экрана.
 */
export type HomeScreenProps = RootAttrs & HomeScreenParams
