/**
 * Технический контракт одноразовой отправки бинарного файла.
 */
export type PresignedUploadInput = {
  /**
   * Подписанный сервером URL.
   */
  url: string
  /**
   * Только предоставленные сервером заголовки S3.
   */
  headers: Record<string, string>
  /**
   * Отправляемое содержимое.
   */
  file: Blob
  /**
   * Отмена при закрытии владельца.
   */
  signal: AbortSignal
  /**
   * Прогресс фактической отправки от 0 до 100.
   */
  onProgress: (progress: number) => void
}
