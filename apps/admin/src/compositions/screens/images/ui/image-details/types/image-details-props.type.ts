import type { ImageClassification, ImageFacets, ProjectImage } from 'domains/images'

/**
 * Параметры компонента ImageDetails.
 */
export type ImageDetailsParams = {
  /**
   * Подробности выбранного изображения.
   */
  image: ProjectImage | undefined
  /**
   * Открыта панель.
   */
  isOpened: boolean
  /**
   * Загружаются подробности.
   */
  isLoading: boolean
  /**
   * Ошибка чтения.
   */
  errorMessage?: string
  /**
   * Варианты классификации.
   */
  facets: ImageFacets | undefined
  /**
   * Право изменения метаданных.
   */
  canUpdate: boolean
  /**
   * Право повторной обработки.
   */
  canRetry: boolean
  /**
   * Закрывает панель.
   */
  onClose: () => void
  /**
   * Обновляет подробности.
   */
  onRefresh: () => void
  /**
   * Сохраняет классификацию.
   */
  onSave: (id: string, input: ImageClassification) => Promise<ProjectImage>
  /**
   * Повторяет ошибочное задание.
   */
  onRetry: (id: string) => Promise<void>
  /**
   * Получает авторизованную короткоживущую ссылку на исходник.
   */
  onOriginal: (id: string) => Promise<string>
}

/**
 * Свойства панели подробностей.
 */
export type ImageDetailsProps = ImageDetailsParams
