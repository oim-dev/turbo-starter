import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры начального экрана.
 */
type HomeScreenParams = object

/**
 * Атрибуты корневого раздела начального экрана.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства начального экрана.
 */
export type HomeScreenProps = RootAttrs & HomeScreenParams
