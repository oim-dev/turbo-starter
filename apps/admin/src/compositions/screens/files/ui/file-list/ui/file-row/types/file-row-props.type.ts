import type { ComponentPropsWithoutRef } from 'react'
import type { ProjectFile } from 'domains/files'

/**
 * Параметры компонента FileRow.
 */
export type FileRowParams = {
  /**
   * Документ строки.
   */
  file: ProjectFile
  /**
   * Открывает паспорт документа.
   */
  onOpen: (id: string) => void
}

/**
 * Атрибуты корневого элемента компонента.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'li'>, 'children'>

/**
 * Свойства компонента FileRow.
 */
export type FileRowProps = RootAttrs & FileRowParams
