import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры общего состояния ожидания маршрута.
 */
export type RoutePendingParams = object

/**
 * Атрибуты корневого элемента состояния ожидания маршрута.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства общего состояния ожидания маршрута.
 */
export type RoutePendingProps = RootAttrs & RoutePendingParams
