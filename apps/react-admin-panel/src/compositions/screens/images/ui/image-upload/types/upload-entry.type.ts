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
  status: 'waiting' | 'uploading' | 'done' | 'failed' | 'cancelled'
  /**
   * Фактический прогресс передачи.
   */
  progress: number
  /**
   * Подсказка ошибки.
   */
  errorMessage: string | null
}
