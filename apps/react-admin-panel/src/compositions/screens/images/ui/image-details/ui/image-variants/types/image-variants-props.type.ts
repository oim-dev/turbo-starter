import type { ImageVariant } from 'domains/images'

/**
 * Параметры компонента ImageVariants.
 */
export type ImageVariantsParams = {
  /**
   * Полный готовый манифест.
   */
  variants: ImageVariant[]
}

/**
 * Свойства таблицы готовых вариантов.
 */
export type ImageVariantsProps = ImageVariantsParams
