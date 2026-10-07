import { parseRichTextDocument } from '@biocad/rich-text'
import { parsePublicationCategory } from 'domains/publication-categories'
import {
  hasOwn,
  isArrayOf,
  isNotDefined,
  isNumber,
  isOneOf,
  isRecord,
  isString
} from '@biocad/value-predicates'

import type {
  Publication,
  PublicationArtifact,
  PublicationPage,
  PublicationStatus,
  PublicationSummary
} from '../types/publication.type'
import { PUBLICATION_STATUSES } from '../types/publication.type'
import type { PublicationUploadIntent } from '../types/publication-upload.type'

const READY_ARTIFACT_STATES = ['ready'] as const

/**
 * Читает обязательное строковое поле внешнего ответа.
 */
const readString = (value: Record<PropertyKey, unknown>, key: PropertyKey): string => {
  if (!hasOwn(value, key) || !isString(value[key])) {
    throw new TypeError(`Publication response field "${String(key)}" is invalid`)
  }

  return value[key]
}

/**
 * Читает обязательное конечное число внешнего ответа.
 */
const readNumber = (value: Record<PropertyKey, unknown>, key: PropertyKey): number => {
  if (!hasOwn(value, key) || !isNumber(value[key])) {
    throw new TypeError(`Publication response field "${String(key)}" is invalid`)
  }

  return value[key]
}

/**
 * Читает nullable string внешнего ответа.
 */
const readNullableString = (value: Record<PropertyKey, unknown>, key: PropertyKey): string | null => {
  if (!hasOwn(value, key) || isNotDefined(value[key])) {
    return null
  }

  if (!isString(value[key])) {
    throw new TypeError(`Publication response field "${String(key)}" is invalid`)
  }

  return value[key]
}

/**
 * Читает nullable number внешнего ответа.
 */
const readNullableNumber = (value: Record<PropertyKey, unknown>, key: PropertyKey): number | null => {
  if (!hasOwn(value, key) || isNotDefined(value[key])) {
    return null
  }

  if (!isNumber(value[key])) {
    throw new TypeError(`Publication response field "${String(key)}" is invalid`)
  }

  return value[key]
}

/**
 * Проверяет status discriminator ответа публикации.
 */
const readPublicationStatus = (value: Record<PropertyKey, unknown>): PublicationStatus => {
  const status = readString(value, 'status')

  if (!isOneOf(status, PUBLICATION_STATUSES)) {
    throw new TypeError('Publication response status is invalid')
  }

  return status
}

/**
 * Адаптирует готовый media artifact к доменной модели.
 */
export const mapPublicationArtifactResponse = (response: unknown): PublicationArtifact => {
  if (!isRecord(response)) {
    throw new TypeError('Publication artifact response has an invalid shape')
  }

  return {
    height: readNullableNumber(response, 'height'),
    id: readString(response, 'objectGuid'),
    mimeType: readNullableString(response, 'mimeType'),
    url: readNullableString(response, 'publicUrl'),
    width: readNullableNumber(response, 'width')
  }
}

/**
 * Адаптирует только подтверждённый ready artifact после complete.
 */
export const mapReadyPublicationArtifactResponse = (response: unknown): PublicationArtifact => {
  if (!isRecord(response) || !isOneOf(readString(response, 'state'), READY_ARTIFACT_STATES)) {
    throw new TypeError('Completed publication artifact is not ready')
  }

  return mapPublicationArtifactResponse(response)
}

/**
 * Адаптирует nullable cover внешнего ответа.
 */
const mapPublicationCover = (response: unknown, alt: string): PublicationArtifact | null => {
  if (isNotDefined(response)) {
    return null
  }

  return { ...mapPublicationArtifactResponse(response), alt }
}

/**
 * Адаптирует общую часть publication response.
 */
const mapPublicationSummaryRecord = (response: Record<PropertyKey, unknown>): PublicationSummary => {
  const coverAlt = readString(response, 'coverAlt')

  if (!hasOwn(response, 'category')) {
    throw new TypeError('Publication response category is missing')
  }

  return {
    category: parsePublicationCategory(response.category),
    cover: mapPublicationCover(response.cover, coverAlt),
    createdAt: readString(response, 'createdAt'),
    excerpt: readString(response, 'excerpt'),
    id: readString(response, 'objectGuid'),
    publishedAt: readNullableString(response, 'publishedAt'),
    slug: readString(response, 'slug'),
    status: readPublicationStatus(response),
    title: readString(response, 'title'),
    updatedAt: readString(response, 'updatedAt'),
    version: readNumber(response, 'version')
  }
}

/**
 * Адаптирует краткий publication response к доменной модели.
 */
export const mapPublicationSummaryResponse = (response: unknown): PublicationSummary => {
  if (!isRecord(response)) {
    throw new TypeError('Publication summary response has an invalid shape')
  }

  return mapPublicationSummaryRecord(response)
}

/**
 * Адаптирует страницу publication responses к доменной выдаче.
 */
export const mapPublicationPageResponse = (response: unknown): PublicationPage => {
  if (!isRecord(response) || !hasOwn(response, 'items') || !isArrayOf(response.items, isRecord)) {
    throw new TypeError('Publication page response has an invalid shape')
  }

  return {
    items: response.items.map(mapPublicationSummaryResponse),
    page: readNumber(response, 'page'),
    pageSize: readNumber(response, 'pageSize'),
    total: readNumber(response, 'total')
  }
}

/**
 * Адаптирует полную публикацию к доменному контракту редактора.
 */
export const mapPublicationResponse = (response: unknown): Publication => {
  if (
    !isRecord(response)
    || !hasOwn(response, 'body')
    || !hasOwn(response, 'mediaArtifacts')
    || !isArrayOf(response.mediaArtifacts, isRecord)
  ) {
    throw new TypeError('Publication detail response has an invalid shape')
  }

  return {
    ...mapPublicationSummaryRecord(response),
    body: parseRichTextDocument(response.body),
    coverAlt: readString(response, 'coverAlt'),
    mediaArtifacts: response.mediaArtifacts.map(mapPublicationArtifactResponse)
  }
}

/**
 * Адаптирует upload intent к внутреннему контракту загрузки.
 */
export const mapPublicationUploadIntentResponse = (
  response: unknown
): PublicationUploadIntent => {
  if (!isRecord(response) || !hasOwn(response, 'fields') || !isRecord(response.fields)) {
    throw new TypeError('Publication upload intent response has an invalid shape')
  }

  const fields = Object.fromEntries(
    Object.entries(response.fields).map(([name, value]) => {
      if (!isString(value)) {
        throw new TypeError('Publication upload intent contains an invalid field')
      }

      return [name, value]
    })
  )

  return {
    artifactId: readString(response, 'artifactObjectGuid'),
    fields,
    url: readString(response, 'url')
  }
}

/**
 * Адаптирует ответ AI source к plain text результату.
 */
export const mapPublicationAiResponse = (response: unknown): string => {
  if (!isRecord(response)) {
    throw new TypeError('Publication AI response has an invalid shape')
  }

  return readString(response, 'text')
}
