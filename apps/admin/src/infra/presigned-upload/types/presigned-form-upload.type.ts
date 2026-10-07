/**
 * Browser POST в заранее подписанную форму object storage.
 */
export type PresignedFormUpload = {
  /** Поля, подписанные storage provider. */
  fields: Readonly<Record<string, string>>
  /** Загружаемый файл. */
  file: File
  /** Получает фактический прогресс отправки тела запроса в процентах. */
  onProgress?: (progress: number) => void
  /** Сигнал отмены в lifecycle вызывающего сценария. */
  signal?: AbortSignal
  /** Подписанный URL object storage. */
  url: string
}
