import { adminRestApi } from 'infra/admin-rest-api'
import { mapPublicationSourceError } from '../errors/publication.error'
import {
  mapPublicationPageResponse,
  mapPublicationResponse
} from '../mappers/publication-response.mapper'
import type {
  Publication,
  PublicationDraft,
  PublicationFilters,
  PublicationPage
} from '../types/publication.type'

/**
 * Адаптирует nullable UUID к ошибочно сгенерированному object source type.
 *
 * OpenAPI runtime передаёт UUID string, несмотря на текущий generated declaration.
 */
const mapCoverArtifactIdToSource = (artifactId: string | null): object | null => {
  return artifactId as unknown as object | null
}

/**
 * Загружает список публикаций через configured Admin SDK.
 */
export const listPublications = async (
  filters: PublicationFilters,
  signal: AbortSignal
): Promise<PublicationPage> => {
  try {
    const response: unknown = await adminRestApi.publications.listAdminPublications(
      {
        page: filters.page,
        pageSize: filters.pageSize,
        categoryObjectGuid: filters.categoryId ?? undefined,
        search: filters.search.trim() || undefined,
        status: filters.status ?? undefined
      },
      { signal }
    )

    return mapPublicationPageResponse(response)
  } catch (error) {
    throw mapPublicationSourceError(error)
  }
}

/**
 * Загружает актуальную версию одной публикации.
 */
export const getPublication = async (
  publicationId: string,
  signal?: AbortSignal
): Promise<Publication> => {
  try {
    const response: unknown = await adminRestApi.publications.getAdminPublication(
      { objectGuid: publicationId },
      { signal }
    )

    return mapPublicationResponse(response)
  } catch (error) {
    throw mapPublicationSourceError(error)
  }
}

/**
 * Создаёт сохранённый draft публикации.
 */
export const createPublication = async (
  draft: PublicationDraft,
  signal?: AbortSignal
): Promise<Publication> => {
  try {
    const response: unknown = await adminRestApi.publications.createAdminPublication(
      {
        body: draft.body,
        categoryObjectGuid: draft.categoryId,
        coverAlt: draft.coverAlt.trim(),
        coverArtifactObjectGuid: draft.cover?.id,
        excerpt: draft.excerpt.trim(),
        slug: draft.slug.trim(),
        title: draft.title.trim()
      },
      { signal }
    )

    return mapPublicationResponse(response)
  } catch (error) {
    throw mapPublicationSourceError(error)
  }
}

/**
 * Сохраняет поля публикации только при совпадении optimistic version.
 */
export const updatePublication = async (
  publicationId: string,
  expectedVersion: number,
  draft: PublicationDraft,
  signal?: AbortSignal
): Promise<Publication> => {
  try {
    const response: unknown = await adminRestApi.publications.updateAdminPublication(
      { objectGuid: publicationId },
      {
        body: draft.body,
        categoryObjectGuid: draft.categoryId,
        coverAlt: draft.coverAlt.trim(),
        coverArtifactObjectGuid: mapCoverArtifactIdToSource(draft.cover?.id ?? null),
        excerpt: draft.excerpt.trim(),
        expectedVersion,
        slug: draft.slug.trim(),
        title: draft.title.trim()
      },
      { signal }
    )

    return mapPublicationResponse(response)
  } catch (error) {
    throw mapPublicationSourceError(error)
  }
}

/**
 * Публикует сохранённую версию материала.
 */
export const publishPublication = async (
  publicationId: string,
  expectedVersion: number,
  signal?: AbortSignal
): Promise<Publication> => {
  try {
    const response: unknown = await adminRestApi.publications.publishAdminPublication(
      { objectGuid: publicationId },
      { expectedVersion },
      { signal }
    )

    return mapPublicationResponse(response)
  } catch (error) {
    throw mapPublicationSourceError(error)
  }
}

/**
 * Возвращает опубликованный материал в draft при совпадении версии.
 */
export const unpublishPublication = async (
  publicationId: string,
  expectedVersion: number,
  signal?: AbortSignal
): Promise<Publication> => {
  try {
    const response: unknown = await adminRestApi.publications.unpublishAdminPublication(
      { objectGuid: publicationId },
      { expectedVersion },
      { signal }
    )

    return mapPublicationResponse(response)
  } catch (error) {
    throw mapPublicationSourceError(error)
  }
}
