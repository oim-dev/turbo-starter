import { hasOwn, isNotDefined, isOneOf, isRecord, isString } from '@biocad/value-predicates'

import { AdminRestApiError } from 'infra/admin-rest-api'

/**
 * Ожидаемые неуспешные исходы сценариев публикаций.
 */
export const PUBLICATION_ERROR_CODES = [
  'NOT_FOUND',
  'CATEGORY_NOT_FOUND',
  'SLUG_CONFLICT',
  'VERSION_CONFLICT',
  'INVALID_DOCUMENT',
  'ARTIFACT_NOT_READY',
  'INVALID_STATUS_TRANSITION',
  'INVALID_UPLOAD',
  'AI_UNAVAILABLE',
  'UNAVAILABLE'
] as const

/**
 * Код ожидаемого исхода домена публикаций.
 */
export type PublicationErrorCode = (typeof PUBLICATION_ERROR_CODES)[number]

const ERROR_MESSAGES: Record<PublicationErrorCode, string> = {
  AI_UNAVAILABLE: 'AI-помощник временно недоступен. Повторите попытку позже.',
  ARTIFACT_NOT_READY: 'Дождитесь завершения загрузки всех изображений.',
  CATEGORY_NOT_FOUND: 'Выбранная категория не найдена или была удалена.',
  INVALID_DOCUMENT: 'Содержимое публикации не прошло проверку.',
  INVALID_STATUS_TRANSITION: 'Публикацию нельзя перевести в выбранное состояние.',
  INVALID_UPLOAD: 'Не удалось загрузить изображение. Проверьте формат и размер файла.',
  NOT_FOUND: 'Публикация не найдена или была удалена.',
  SLUG_CONFLICT: 'Этот slug уже используется другой публикацией.',
  UNAVAILABLE: 'Не удалось выполнить запрос. Повторите попытку.',
  VERSION_CONFLICT: 'Публикация была изменена в другой сессии.'
}

/**
 * Представляет ожидаемый исход сценария публикаций без transport details.
 */
export class PublicationError extends Error {
  readonly code: PublicationErrorCode

  constructor(code: PublicationErrorCode) {
    super(ERROR_MESSAGES[code])
    this.name = 'PublicationError'
    this.code = code
  }
}

/**
 * Проверяет доменную ошибку и опционально её конкретный исход.
 */
export const isPublicationError = (
  error: unknown,
  code?: PublicationErrorCode
): error is PublicationError => {
  if (!(error instanceof PublicationError)) {
    return false
  }

  return isNotDefined(code) || error.code === code
}

/**
 * Преобразует ошибку configured Admin API в ожидаемый доменный исход.
 */
export const mapPublicationSourceError = (
  error: unknown,
  fallbackCode: PublicationErrorCode = 'UNAVAILABLE'
): PublicationError => {
  if (isPublicationError(error)) {
    return error
  }

  if (
    error instanceof AdminRestApiError
    && isRecord(error.error)
    && hasOwn(error.error, 'code')
    && isString(error.error.code)
    && isOneOf(error.error.code, PUBLICATION_ERROR_CODES)
  ) {
    return new PublicationError(error.error.code)
  }

  return new PublicationError(fallbackCode)
}
