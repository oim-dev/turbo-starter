import type { ImageFacets, ImageUploadInput, ImageUploadProgress, ImageUploadResult } from 'domains/images'
import type { NativeFileDrop } from 'infra/native-file-drop'

/**
 * Параметры компонента ImageUpload.
 */
export type ImageUploadParams = {
  /**
   * Панель открыта.
   */
  isOpened: boolean
  /**
   * Первая пачка со страницы; читается только при создании очереди.
   */
  initialBatch: NativeFileDrop
  /**
   * Предвыбранная папка медиатеки.
   */
  initialFolder: string | null
  /**
   * Подсказки классификации.
   */
  facets: ImageFacets | undefined
  /**
   * Закрытие формы.
   */
  onClose: () => void
  /**
   * Отправка оригинала и подтверждение задания.
   */
  onUpload: (
    file: File,
    input: ImageUploadInput,
    onProgress: (progress: ImageUploadProgress) => void,
    signal: AbortSignal
  ) => Promise<ImageUploadResult>
  /**
   * Переход к обновлённой медиатеке.
   */
  onUploaded: () => void
  /**
   * Открывает каноническое изображение из результата очереди.
   */
  onOpenImage: (id: string) => void
}

/**
 * Свойства формы загрузки.
 */
export type ImageUploadProps = ImageUploadParams
