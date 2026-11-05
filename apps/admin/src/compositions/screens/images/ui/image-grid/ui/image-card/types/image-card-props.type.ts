import type { ComponentPropsWithoutRef } from 'react'
import type { ProjectImage } from 'domains/images'

/**
 * Параметры компонента ImageCard.
 */
export type ImageCardParams = {
  /**
   * Изображение карточки.
   */
  image: ProjectImage
  /**
   * Открытие подробностей.
   */
  onOpen: (id: string) => void
}

/**
 * Атрибуты корневого элемента компонента.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'article'>, 'children' | 'onClick'>

/**
 * Свойства компонента ImageCard.
 */
export type ImageCardProps = RootAttrs & ImageCardParams
