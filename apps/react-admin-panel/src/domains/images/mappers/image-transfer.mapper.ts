import type { ImageOriginalLinkDto, ImageUploadTargetDto } from 'infra/backend-admin-api'
import type { PresignedUploadInput } from 'infra/presigned-upload'
import { hasOwn, isRecord, isString } from 'shared/value-predicates'

/**
 * Проверяет адрес временной передачи и его срок без изменения подписи.
 */
const isValidTransferLink = (payload: unknown): payload is ImageOriginalLinkDto => {
  if (!isRecord(payload) || !hasOwn(payload, 'url') || !isString(payload.url)
    || !hasOwn(payload, 'expiresAt') || !isString(payload.expiresAt)) return false
  const expiresAt = Date.parse(payload.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false
  try {
    const url = new URL(payload.url)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

/**
 * Проверяет техническую цель загрузки, сохраняя server-provided заголовки.
 */
export const mapUploadTarget = (payload: ImageUploadTargetDto): Pick<PresignedUploadInput, 'url' | 'headers'> => {
  if (!isValidTransferLink(payload) || !hasOwn(payload, 'method') || payload.method !== 'PUT'
    || !hasOwn(payload, 'headers') || !isRecord(payload.headers)
    || !Object.values(payload.headers).every(isString)) throw new Error('Invalid image upload target')
  return { url: payload.url, headers: { ...payload.headers } }
}

/**
 * Возвращает временную ссылку после проверки URL и срока; она не становится частью модели.
 */
export const mapOriginalLink = (payload: ImageOriginalLinkDto): string => {
  if (!isValidTransferLink(payload)) throw new Error('Invalid image original link')
  return payload.url
}
