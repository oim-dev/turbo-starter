import type { FileFacets, ProjectFile, UploadFile } from 'domains/files'
import type { NativeFileDrop } from 'infra/native-file-drop'

/**
 * Входной контракт самостоятельной очереди документов.
 */
export type FileUploadProps = {
  /**
   * Первая пачка с устройства, передаётся один раз при открытии.
   */
  initialBatch: NativeFileDrop
  /**
   * Папка, выбранная на странице.
   */
  initialFolder: string | null
  /**
   * Документ для новой версии; отсутствует в режиме новых документов.
   */
  target?: Pick<ProjectFile, 'id' | 'title' | 'filename'>
  /**
   * Подсказки классификации.
   */
  facets?: FileFacets
  /**
   * Передаёт и подтверждает файл.
   */
  onUpload: UploadFile
  /**
   * Закрывает очередь.
   */
  onClose: () => void
  /**
   * Закрывает очередь и показывает полученный результат.
   */
  onFinished: () => void
}
