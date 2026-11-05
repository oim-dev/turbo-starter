import type { ImageClassification, ImageFacets, ProjectImage } from 'domains/images'

/**
 * Параметры компонента ImageClassification.
 */
export type ImageClassificationParams = {
  /**
   * Исходные метаданные.
   */
  image: ProjectImage
  /**
   * Варианты существующих категорий.
   */
  facets: ImageFacets | undefined
  /**
   * Право редактирования.
   */
  canUpdate: boolean
  /**
   * Сохранение классификации и обновление кеша владельцем.
   */
  onSave: (id: string, input: ImageClassification) => Promise<ProjectImage>
}

/**
 * Свойства формы классификации.
 */
export type ImageClassificationProps = ImageClassificationParams
