import { hasOwn, isArrayOf, isNumber, isRecord, isString } from '@biocad/value-predicates'

import type {
  AdminPublicationCategory,
  PublicationCategory,
  PublicationCategoryPage
} from '../types/publication-category.type'

/**
 * Читает обязательную строку из внешнего ответа категории.
 */
const readString = (value: Record<PropertyKey, unknown>, key: PropertyKey): string => {
  if (!hasOwn(value, key) || !isString(value[key])) {
    throw new TypeError(`Publication category response field "${String(key)}" is invalid`)
  }

  return value[key]
}

/**
 * Читает обязательное число из внешнего ответа категории.
 */
const readNumber = (value: Record<PropertyKey, unknown>, key: PropertyKey): number => {
  if (!hasOwn(value, key) || !isNumber(value[key])) {
    throw new TypeError(`Publication category response field "${String(key)}" is invalid`)
  }

  return value[key]
}

/**
 * Адаптирует публичную часть категории к доменной модели.
 */
export const parsePublicationCategory = (response: unknown): PublicationCategory => {
  if (!isRecord(response)) {
    throw new TypeError('Publication category response has an invalid shape')
  }

  return {
    id: readString(response, 'objectGuid'),
    name: readString(response, 'name'),
    slug: readString(response, 'slug')
  }
}

/**
 * Адаптирует административную категорию к доменной модели управления.
 */
export const mapAdminPublicationCategoryResponse = (response: unknown): AdminPublicationCategory => {
  if (!isRecord(response)) {
    throw new TypeError('Admin publication category response has an invalid shape')
  }

  return {
    ...parsePublicationCategory(response),
    createdAt: readString(response, 'createdAt'),
    publicationCount: readNumber(response, 'publicationCount'),
    updatedAt: readString(response, 'updatedAt'),
    version: readNumber(response, 'version')
  }
}

/**
 * Адаптирует страницу категорий к доменной выдаче.
 */
export const mapPublicationCategoryPageResponse = (response: unknown): PublicationCategoryPage => {
  if (!isRecord(response) || !hasOwn(response, 'items') || !isArrayOf(response.items, isRecord)) {
    throw new TypeError('Publication category page response has an invalid shape')
  }

  return {
    items: response.items.map(mapAdminPublicationCategoryResponse),
    page: readNumber(response, 'page'),
    pageSize: readNumber(response, 'pageSize'),
    total: readNumber(response, 'total')
  }
}
