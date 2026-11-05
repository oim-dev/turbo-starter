import type { FileUploadCheckpoint, FileUploadProgress, FileUploadResult } from 'domains/files'

/**
 * Локальная запись очереди, включая контрольную точку ручного повтора.
 */
export type UploadEntryState = {
  /**
   * Устойчивый ключ строки.
   */
  id: string
  /**
   * Выбранные на устройстве байты.
   */
  file: File
  /**
   * Наблюдаемый этап.
   */
  status: FileUploadProgress['phase'] | 'waiting' | 'done' | 'failed' | 'cancelled'
  /**
   * Процент передачи байтов.
   */
  percent: number
  /**
   * Безопасное пояснение отказа.
   */
  error: string | null
  /**
   * Продолжение уже созданной попытки.
   */
  checkpoint?: FileUploadCheckpoint
  /**
   * Квитанция о созданной или найденной версии.
   */
  receipt?: FileUploadResult
}

/**
 * Классификация новых документов очереди.
 */
export type UploadClassificationForm = {
  /**
   * Папка новых документов.
   */
  folder: string
  /**
   * Теги новых документов.
   */
  tags: string[]
}
