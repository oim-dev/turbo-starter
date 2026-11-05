import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Параметры системного экрана.
 */
export type SystemStateScreenParams = {
  /**
   * Состояние границы маршрута.
   */
  kind: 'not-found' | 'error'
  /**
   * Дополнительное действие восстановления.
   */
  children?: ReactNode
}

/**
 * Атрибуты основного содержимого системного экрана.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Свойства системного экрана.
 */
export type SystemStateScreenProps = RootAttrs & SystemStateScreenParams
