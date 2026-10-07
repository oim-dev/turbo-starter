import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры безопасного сообщения об ошибке маршрута.
 */
export type RouteErrorBoundaryParams = object

/**
 * Атрибуты корневого элемента сообщения об ошибке маршрута.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Свойства безопасного сообщения об ошибке маршрута.
 */
export type RouteErrorBoundaryProps = RootAttrs & RouteErrorBoundaryParams
