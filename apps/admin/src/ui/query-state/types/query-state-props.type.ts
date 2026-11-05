import type { ComponentPropsWithoutRef } from 'react'

/**
 * Состояние чтения данных и доступное восстановление.
 */
export type QueryStateParams = {
  /**
   * Показывать каркас загрузки.
   */
  isLoading: boolean
  /**
   * Описание ошибки либо загружаемых данных.
   */
  title: string
  /**
   * Повторяет только чтение данных.
   */
  onRetry: () => void
}

/**
 * Атрибуты поверхности состояния, содержимым которой управляет компонент.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'title' | 'aria-busy' | 'aria-label'>

/**
 * Свойства компонента состояния запроса.
 */
export type QueryStateProps = RootAttrs & QueryStateParams
