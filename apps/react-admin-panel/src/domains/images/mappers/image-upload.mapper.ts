import type { PresignedUploadInput } from 'infra/presigned-upload'
import { hasOwn, isBoolean, isRecord } from 'shared/value-predicates'
import type { ProjectImage } from '../types/image.type'
import type { ImageUploadResult } from '../types/image-upload.type'
import { mapImage } from './image.mapper'
import { mapUploadTarget } from './image-transfer.mapper'

/**
 * Проверенное решение сервера до передачи оригинала.
 */
type ImageUploadDecision = {
  /**
   * Существующий оригинал подтверждён сервером.
   */
  isReused: true
  /**
   * Каноническое существующее изображение.
   */
  image: ProjectImage
  /**
   * Повторная передача не нужна.
   */
  upload: null
} | {
  /**
   * Требуется передача нового оригинала.
   */
  isReused: false
  /**
   * Новая загрузка до подтверждения.
   */
  image: ProjectImage
  /**
   * Проверенная цель передачи оригинала.
   */
  upload: Pick<PresignedUploadInput, 'url' | 'headers'>
}

/**
 * Проверяет сочетание reused/upload и связь ответа с вычисленным отпечатком.
 */
export const mapImageUploadDecision = (payload: unknown, sha256: string): ImageUploadDecision => {
  if (!isRecord(payload)
    || !hasOwn(payload, 'image') || !hasOwn(payload, 'upload')
    || !hasOwn(payload, 'reused') || !isBoolean(payload.reused)) {
    throw new Error('Invalid image upload response')
  }
  const image = mapImage(payload.image)
  if (payload.reused) {
    if (payload.upload !== null || image.status === 'uploading' || image.original.sha256 !== sha256) {
      throw new Error('Invalid reused image response')
    }
    return { image, isReused: true, upload: null }
  }
  if (image.status !== 'uploading' || (image.original.sha256 !== null && image.original.sha256 !== sha256)) {
    throw new Error('Invalid new image response')
  }
  return { image, isReused: false, upload: mapUploadTarget(payload.upload) }
}

/**
 * Читает плоский complete-ответ и сохраняет канонический ID при дедупликации гонки.
 */
export const mapImageComplete = (payload: unknown, uploadedId: string, sha256: string): ImageUploadResult => {
  if (!isRecord(payload) || !hasOwn(payload, 'reused') || !isBoolean(payload.reused)) {
    throw new Error('Invalid image complete response')
  }
  const image = mapImage(payload)
  if (image.status === 'uploading' || image.original.sha256 !== sha256 || (!payload.reused && image.id !== uploadedId)) {
    throw new Error('Invalid completed image identity')
  }
  return { image, isReused: payload.reused }
}
