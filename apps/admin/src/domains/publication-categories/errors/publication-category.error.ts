import { hasOwn, isOneOf, isRecord, isString } from '@biocad/value-predicates'

import { AdminRestApiError } from 'infra/admin-rest-api'

/**
 * Ожидаемые исходы операций с категориями публикаций.
 */
export const PUBLICATION_CATEGORY_ERROR_CODE = {
  /** Категория не существует. */
  NOT_FOUND: 'CATEGORY_NOT_FOUND',
  /** Slug уже занят другой категорией. */
  SLUG_CONFLICT: 'CATEGORY_SLUG_CONFLICT',
  /** Категория используется публикациями. */
  IN_USE: 'CATEGORY_IN_USE',
  /** Категория была изменена в другой сессии. */
  VERSION_CONFLICT: 'VERSION_CONFLICT'
} as const

/**
 * Код ожидаемого исхода категории.
 */
export type PublicationCategoryErrorCode =
  (typeof PUBLICATION_CATEGORY_ERROR_CODE)[keyof typeof PUBLICATION_CATEGORY_ERROR_CODE]

/**
 * Ожидаемая ошибка операции с категорией.
 */
export type PublicationCategoryError = Error & Readonly<{
  /** Стабильный код доменного исхода. */
  code: PublicationCategoryErrorCode
  /** Маркер доменной ошибки категорий. */
  name: 'PublicationCategoryError'
}>

const ERROR_MESSAGES: Record<PublicationCategoryErrorCode, string> = {
  CATEGORY_IN_USE: 'Категорию нельзя удалить, пока в ней есть публикации.',
  CATEGORY_NOT_FOUND: 'Категория не найдена или уже удалена.',
  CATEGORY_SLUG_CONFLICT: 'Этот slug уже используется другой категорией.',
  VERSION_CONFLICT: 'Категория была изменена в другой сессии.'
}

/**
 * Внутренняя реализация ожидаемой ошибки категории.
 */
class PublicationCategoryErrorImpl extends Error implements PublicationCategoryError {
  readonly code: PublicationCategoryErrorCode
  readonly name = 'PublicationCategoryError'

  constructor(code: PublicationCategoryErrorCode) {
    super(ERROR_MESSAGES[code])
    this.code = code
  }
}

/**
 * Проверяет ожидаемую ошибку категории и опционально её код.
 */
export const isPublicationCategoryError = (
  value: unknown,
  code?: PublicationCategoryErrorCode
): value is PublicationCategoryError => {
  if (!(value instanceof PublicationCategoryErrorImpl)) {
    return false
  }

  return code === undefined || value.code === code
}

/**
 * Преобразует известную source error в ожидаемый доменный исход.
 *
 * Неизвестная ошибка не маскируется ожидаемым кодом.
 */
export const mapPublicationCategorySourceError = (
  error: unknown
): PublicationCategoryError | TypeError | DOMException => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return error
  }

  if (
    error instanceof AdminRestApiError
    && isRecord(error.error)
    && hasOwn(error.error, 'code')
    && isString(error.error.code)
    && isOneOf(error.error.code, [
      PUBLICATION_CATEGORY_ERROR_CODE.NOT_FOUND,
      PUBLICATION_CATEGORY_ERROR_CODE.SLUG_CONFLICT,
      PUBLICATION_CATEGORY_ERROR_CODE.IN_USE,
      PUBLICATION_CATEGORY_ERROR_CODE.VERSION_CONFLICT
    ])
  ) {
    return new PublicationCategoryErrorImpl(error.error.code)
  }

  return new TypeError('Unexpected publication category source failure')
}
