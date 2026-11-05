import type { ComponentPropsWithoutRef } from 'react'
import type { FileClassification, FileFacets, ProjectFile } from 'domains/files'

/**
 * Входные данные формы классификации.
 */
export type FileClassificationParams = {
  /**
   * Документ для первичной инициализации.
   */
  file: ProjectFile
  /**
   * Подсказки папок и тегов.
   */
  facets?: FileFacets
  /**
   * Право редактирования.
   */
  canUpdate: boolean
  /**
   * Сохраняет значения на сервере.
   */
  onSave: (id: string, input: FileClassification) => Promise<ProjectFile>
}

/**
 * Атрибуты формы, кроме управляемой отправки.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'form'>, 'children' | 'onSubmit'>

/**
 * Публичные свойства формы.
 */
export type FileClassificationProps = FileClassificationParams & RootAttrs

/**
 * Черновик классификации с вводимой строкой папки.
 */
export type FileClassificationForm = {
  /**
   * Редактируемое имя документа для отображения и URL.
   */
  title: string
  /**
   * Папка или пустая строка.
   */
  folder: string
  /**
   * Теги документа.
   */
  tags: string[]
}
