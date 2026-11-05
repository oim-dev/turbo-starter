import type { FileUploadResult } from '../types/file-upload.type'

/**
 * Подтверждает соответствие ответа выбранным байтам и назначению версии.
 */
export const verifyUploadResult = (receipt: FileUploadResult, sha256: string, targetId?: string): FileUploadResult => {
  if (receipt.version.sha256 !== sha256 || (targetId !== undefined && receipt.file.id !== targetId)) throw new Error('File upload result does not match input')
  return receipt
}
