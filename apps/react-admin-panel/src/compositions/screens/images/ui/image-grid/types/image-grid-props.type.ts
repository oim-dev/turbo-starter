import type { ComponentPropsWithoutRef } from 'react'
import type { ProjectImage } from 'domains/images'

/**
 * Параметры компонента ImageGrid.
 */
export type ImageGridParams = {
  /**
   * Изображения текущей страницы.
   */
  images: ProjectImage[]
  /**
   * Первичная загрузка списка.
   */
  isLoading: boolean
  /**
   * Применены фильтры.
   */
  hasFilters: boolean
  /**
   * Доступно создание загрузки.
   */
  canUpload: boolean
  /**
   * Безопасное сообщение ошибки списка.
   */
  errorMessage?: string
  /**
   * Повторить получение списка.
   */
  onRetry: () => void
  /**
   * Снять фильтры.
   */
  onReset: () => void
  /**
   * Открыть загрузку.
   */
  onUpload: () => void
  /**
   * Открыть подробности изображения.
   */
  onOpen: (id: string) => void
}

/**
 * Атрибуты корневого элемента компонента ImageGrid.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента ImageGrid.
 */
export type ImageGridProps = RootAttrs & ImageGridParams
