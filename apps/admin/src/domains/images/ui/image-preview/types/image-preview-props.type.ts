import type { ComponentPropsWithoutRef } from 'react'
import type { ProjectImage } from '../../../types/image.type'

/**
 * Параметры готового предпросмотра общей медиатеки.
 */
export type ImagePreviewParams = {
  /**
   * Изображение с полным манифестом.
   */
  image: ProjectImage
  /**
   * Реальная ширина слота для responsive выбора.
   */
  sizes?: string
  /**
   * Сохранять видимость всего кадра.
   */
  isContained?: boolean
}

/**
 * Атрибуты корневого элемента компонента.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента ImagePreview.
 */
export type ImagePreviewProps = RootAttrs & ImagePreviewParams
