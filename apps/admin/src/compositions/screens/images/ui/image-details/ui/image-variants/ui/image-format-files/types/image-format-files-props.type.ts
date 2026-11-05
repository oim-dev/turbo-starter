import type { ImageVariant } from 'domains/images'

/**
 * Параметры компонента ImageFormatFiles.
 */
export type ImageFormatFilesParams = {
  /**
   * Опубликованные файлы одного формата по возрастанию ширины.
   */
  variants: readonly ImageVariant[]
}

/**
 * Свойства компонента ImageFormatFiles.
 */
export type ImageFormatFilesProps = ImageFormatFilesParams
