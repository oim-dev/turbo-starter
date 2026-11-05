import type { UploadEntryState } from '../../../types/upload-entry.type'

/**
 * Представление одной локальной передачи.
 */
export type UploadEntryProps = {
  /**
   * Запись очереди.
   */
  entry: UploadEntryState
  /**
   * Выполняется последовательная передача.
   */
  isBusy: boolean
  /**
   * Удаляет запись из очереди.
   */
  onRemove: () => void
  /**
   * Подготавливает явный повтор.
   */
  onRetry: () => void
}
