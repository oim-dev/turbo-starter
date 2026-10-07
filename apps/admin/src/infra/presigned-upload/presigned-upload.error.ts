/**
 * Обозначает отклонённый object storage upload без раскрытия transport response.
 */
export class PresignedUploadError extends Error {
  constructor() {
    super('Presigned upload failed')
    this.name = 'PresignedUploadError'
  }
}
