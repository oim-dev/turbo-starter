import type { FileClassification, FileFacets, ProjectFile } from 'domains/files'

/**
 * Контракт панели паспорта документа.
 */
export type FileDetailsProps = {
  /**
   * Документ, полученный GET-запросом.
   */
  file?: ProjectFile
  /**
   * Открытость панели.
   */
  isOpened: boolean
  /**
   * Ожидание метаданных.
   */
  isLoading: boolean
  /**
   * Ошибка чтения.
   */
  errorMessage?: string
  /**
   * Подсказки классификации.
   */
  facets?: FileFacets
  /**
   * Право редактирования.
   */
  canUpdate: boolean
  /**
   * Право добавления версий.
   */
  canUpload: boolean
  /**
   * Открывает загрузчик версии текущего документа.
   */
  onVersion: () => void
  /**
   * Закрывает панель.
   */
  onClose: () => void
  /**
   * Повторяет чтение.
   */
  onRefresh: () => void
  /**
   * Сохраняет классификацию.
   */
  onSave: (id: string, input: FileClassification) => Promise<ProjectFile>
}
