import type { UploadEntry } from '../../../types/upload-entry.type'

/**
 * Параметры компонента UploadFile.
 */
export type UploadFileParams = {
  /**
   * Файл очереди.
   */
  entry: UploadEntry
  /**
   * Удаление разрешено.
   */
  canRemove: boolean
  /**
   * Удаляет файл и освобождает preview.
   */
  onRemove: (id: string) => void
  /**
   * Возвращает неотправленный файл в очередь явной новой попытки.
   */
  onRequeue: (id: string) => void
}

/**
 * Свойства строки локальной очереди.
 */
export type UploadFileProps = UploadFileParams
