import { IMAGE_UPLOAD_PHASE } from 'domains/images'

/**
 * Локальная очередь файлов одной формы загрузки.
 */
export type UploadEntry = {
  /**
   * Устойчивый локальный идентификатор.
   */
  id: string
  /**
   * Оригинал из файлового диалога.
   */
  file: File
  /**
   * Состояние передачи.
   */
  status: (typeof UPLOAD_ENTRY_STATUS)[keyof typeof UPLOAD_ENTRY_STATUS]
  /**
   * Фактический прогресс передачи.
   */
  progress: number
  /**
   * Подсказка ошибки.
   */
  errorMessage: string | null
  /**
   * Канонический серверный ID для открытия подтверждённого результата.
   */
  imageId: string | null
}
/**
 * Состояния локальной очереди, включая предметные этапы добавления оригинала.
 */
export const UPLOAD_ENTRY_STATUS = {
  ...IMAGE_UPLOAD_PHASE,
  /**
   * Ожидает явного запуска.
   */
  WAITING: 'waiting',
  /**
   * Новый оригинал подтверждён сервером.
   */
  DONE: 'done',
  /**
   * Используется существующее изображение.
   */
  REUSED: 'reused',
  /**
   * Неуспешная попытка с возможностью восстановления.
   */
  FAILED: 'failed',
  /**
   * Пользователь остановил операцию.
   */
  CANCELLED: 'cancelled'
} as const
