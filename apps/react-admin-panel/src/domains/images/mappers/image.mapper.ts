import { hasOwn, isArrayOf, isNumber, isOneOf, isRecord, isString } from 'shared/value-predicates'
import { IMAGE_STATUS } from '../types/image.type'
import type { ImageFacet, ImageFacets, ImagePage, ImageVariant, ProjectImage } from '../types/image.type'

/**
 * Проверяет положительную геометрию готового варианта.
 */
const isPositiveNumber = (number: unknown): number is number => isNumber(number) && number > 0

/**
 * Проверяет вес файла и счётчики.
 */
const isNonNegativeNumber = (number: unknown): number is number => isNumber(number) && number >= 0

/**
 * Проверяет дату до пользовательского форматирования.
 */
const isTimestamp = (timestamp: unknown): timestamp is string => {
  return isString(timestamp) && Number.isFinite(Date.parse(timestamp))
}

/**
 * Проверяет адрес без допуска исполняемых схем URL.
 */
const isImageUrl = (url: unknown): url is string => {
  if (!isString(url)) return false
  if (url.startsWith('/') && !url.startsWith('//')) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Проверяет полный элемент манифеста на границе внешнего источника.
 */
const isImageVariant = (variant: unknown): variant is ImageVariant => {
  return isRecord(variant)
    && hasOwn(variant, 'id') && isString(variant.id)
    && hasOwn(variant, 'width') && isPositiveNumber(variant.width)
    && hasOwn(variant, 'height') && isPositiveNumber(variant.height)
    && hasOwn(variant, 'format') && isString(variant.format)
    && hasOwn(variant, 'mimeType') && isString(variant.mimeType)
    && hasOwn(variant, 'byteSize') && isNonNegativeNumber(variant.byteSize)
    && hasOwn(variant, 'url') && isImageUrl(variant.url)
}

/**
 * Проверяет атрибуцию загрузки, не смешивая типы аккаунтов.
 */
const isImageAuthor = (author: unknown): author is ProjectImage['uploadedBy'] => {
  return isRecord(author)
    && hasOwn(author, 'id') && isString(author.id)
    && hasOwn(author, 'name') && isString(author.name)
    && hasOwn(author, 'login') && isString(author.login)
    && hasOwn(author, 'realm') && isOneOf(author.realm, ['admin', 'client'] as const)
}

/**
 * Проверяет информацию о приватном оригинале.
 */
const isImageOriginal = (original: unknown): original is ProjectImage['original'] => {
  return isRecord(original)
    && hasOwn(original, 'contentType') && isString(original.contentType)
    && hasOwn(original, 'byteSize') && isNonNegativeNumber(original.byteSize)
    && hasOwn(original, 'width') && (original.width === null || isPositiveNumber(original.width))
    && hasOwn(original, 'height') && (original.height === null || isPositiveNumber(original.height))
}

/**
 * Проверяет ошибку обработки, которую сервер разрешил показать пользователю.
 */
const isProcessingError = (error: unknown): error is ProjectImage['error'] => {
  return error === null || (isRecord(error)
    && hasOwn(error, 'code') && isString(error.code)
    && hasOwn(error, 'message') && isString(error.message))
}

/**
 * Проверяет все потребляемые поля изображения до записи в доменный кеш.
 */
const isProjectImage = (image: unknown): image is ProjectImage => {
  return isRecord(image)
    && hasOwn(image, 'id') && isString(image.id)
    && hasOwn(image, 'filename') && isString(image.filename)
    && hasOwn(image, 'title') && isString(image.title)
    && hasOwn(image, 'folder') && (image.folder === null || isString(image.folder))
    && hasOwn(image, 'tags') && isArrayOf(image.tags, isString)
    && hasOwn(image, 'status') && isOneOf(image.status, Object.values(IMAGE_STATUS))
    && hasOwn(image, 'createdAt') && isTimestamp(image.createdAt)
    && hasOwn(image, 'updatedAt') && isTimestamp(image.updatedAt)
    && hasOwn(image, 'uploadedBy') && isImageAuthor(image.uploadedBy)
    && hasOwn(image, 'original') && isImageOriginal(image.original)
    && hasOwn(image, 'variants') && isArrayOf(image.variants, isImageVariant)
    && hasOwn(image, 'error') && isProcessingError(image.error)
}

/**
 * Создаёт предметную модель; незавершённый манифест никогда не публикуется в UI.
 */
export const mapImage = (payload: unknown): ProjectImage => {
  if (!isProjectImage(payload)) throw new Error('Invalid image response')
  return {
    id: payload.id,
    filename: payload.filename,
    title: payload.title,
    folder: payload.folder,
    tags: [...payload.tags],
    status: payload.status,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    uploadedBy: { ...payload.uploadedBy },
    original: { ...payload.original },
    variants: payload.status === 'ready' ? payload.variants.map((variant) => ({
      id: variant.id,
      width: variant.width,
      height: variant.height,
      format: variant.format,
      mimeType: variant.mimeType,
      byteSize: variant.byteSize,
      url: variant.url
    })) : [],
    error: payload.error === null ? null : { ...payload.error }
  }
}

/**
 * Преобразует страницу внешнего списка в проверенные предметные данные.
 */
export const mapImagePage = (payload: unknown): ImagePage => {
  if (!isRecord(payload)
    || !hasOwn(payload, 'items') || !isArrayOf(payload.items, isProjectImage)
    || !hasOwn(payload, 'total') || !isNonNegativeNumber(payload.total)
    || !hasOwn(payload, 'page') || !isPositiveNumber(payload.page)
    || !hasOwn(payload, 'pageSize') || !isPositiveNumber(payload.pageSize)) {
    throw new Error('Invalid image page response')
  }
  return { items: payload.items.map(mapImage), total: payload.total, page: payload.page, pageSize: payload.pageSize }
}

/**
 * Проверяет категорию и её счётчик.
 */
const isImageFacet = (facet: unknown): facet is ImageFacet => {
  return isRecord(facet)
    && hasOwn(facet, 'name') && isString(facet.name)
    && hasOwn(facet, 'count') && isNonNegativeNumber(facet.count)
}

/**
 * Преобразует категории общей медиатеки.
 */
export const mapImageFacets = (payload: unknown): ImageFacets => {
  if (!isRecord(payload)
    || !hasOwn(payload, 'folders') || !isArrayOf(payload.folders, isImageFacet)
    || !hasOwn(payload, 'tags') || !isArrayOf(payload.tags, isImageFacet)
    || !hasOwn(payload, 'total') || !isNonNegativeNumber(payload.total)
    || !hasOwn(payload, 'unfiledCount') || !isNonNegativeNumber(payload.unfiledCount)) {
    throw new Error('Invalid image facets response')
  }
  return {
    folders: payload.folders.map((folder) => ({ ...folder })),
    tags: payload.tags.map((tag) => ({ ...tag })),
    total: payload.total,
    unfiledCount: payload.unfiledCount
  }
}
