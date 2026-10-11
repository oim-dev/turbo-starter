import type { ProjectImage } from './image.type'

/**
 * Этапы добавления оригинала в медиатеку.
 */
export const IMAGE_UPLOAD_PHASE = {
  /**
   * Чтение байтов, SHA-256 и проверка существующего оригинала.
   */
  CHECKING: 'checking',
  /**
   * Передача оригинала в хранилище.
   */
  UPLOADING: 'uploading',
  /**
   * Серверная проверка и подтверждение канонического изображения.
   */
  CONFIRMING: 'confirming'
} as const

/**
 * Прогресс операции: процент отражает только передачу байтов, не вычисление SHA-256.
 */
export type ImageUploadProgress = {
  /**
   * Текущий этап операции.
   */
  phase: (typeof IMAGE_UPLOAD_PHASE)[keyof typeof IMAGE_UPLOAD_PHASE]
  /**
   * Процент переданных байтов от 0 до 100.
   */
  percent: number
}

/**
 * Подтверждённый результат загрузки или повторного использования оригинала.
 */
export type ImageUploadResult = {
  /**
   * Каноническое изображение, включая результат дедупликации при гонке.
   */
  image: ProjectImage
  /**
   * Сервер вернул ранее добавленный оригинал.
   */
  isReused: boolean
}
