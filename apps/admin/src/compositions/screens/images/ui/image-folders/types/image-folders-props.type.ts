import type { ComponentPropsWithoutRef } from 'react'
import type { ImageFacets } from 'domains/images'

/**
 * Параметры компонента ImageFolders.
 */
export type ImageFoldersParams = {
  /**
   * Доступные папки и счётчики.
   */
  facets: ImageFacets | undefined
  /**
   * Текущая папка.
   */
  folder: string | null
  /**
   * Выбрана категория без папки.
   */
  isUnfiled: boolean
  /**
   * Фасеты ещё загружаются.
   */
  isLoading: boolean
  /**
   * Сообщение ошибки загрузки фасетов.
   */
  errorMessage?: string
  /**
   * Повторное получение папок.
   */
  onRetry: () => void
  /**
   * Выбор категории.
   */
  onSelect: (folder: string | null, isUnfiled: boolean) => void
}

/**
 * Атрибуты корневого элемента компонента ImageFolders.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'nav'>, 'children' | 'onSelect'>

/**
 * Свойства компонента ImageFolders.
 */
export type ImageFoldersProps = RootAttrs & ImageFoldersParams
