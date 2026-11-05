import type { ComponentPropsWithoutRef } from 'react'
import type { ProjectFile } from 'domains/files'

/**
 * Параметры компонента FileList.
 */
export type FileListParams = {
  /**
   * Документы текущей страницы.
   */
  files: ProjectFile[]
  /**
   * Ожидание первой страницы.
   */
  isLoading: boolean
  /**
   * Пояснение ошибки чтения.
   */
  errorMessage?: string
  /**
   * Есть ли активные фильтры.
   */
  hasFilters: boolean
  /**
   * Открывает документ в панели.
   */
  onOpen: (id: string) => void
  /**
   * Повторяет чтение списка.
   */
  onRetry: () => void
  /**
   * Снимает фильтры.
   */
  onReset: () => void
}

/**
 * Атрибуты корневого элемента компонента FileList.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента FileList.
 */
export type FileListProps = RootAttrs & FileListParams
