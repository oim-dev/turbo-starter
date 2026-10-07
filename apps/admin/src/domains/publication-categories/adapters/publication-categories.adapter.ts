import { isEmptyArray } from '@biocad/value-predicates'

import { adminRestApi } from 'infra/admin-rest-api'
import { mapPublicationCategorySourceError } from '../errors/publication-category.error'
import {
  mapAdminPublicationCategoryResponse,
  mapPublicationCategoryPageResponse
} from '../mappers/publication-category-response.mapper'
import type {
  AdminPublicationCategory,
  PublicationCategoryFilters,
  PublicationCategoryInput,
  PublicationCategoryPage
} from '../types/publication-category.type'

/**
 * Загружает страницу категорий публикаций.
 */
export const listPublicationCategories = async (
  filters: PublicationCategoryFilters,
  signal?: AbortSignal
): Promise<PublicationCategoryPage> => {
  try {
    const response: unknown = await adminRestApi.publicationCategories.listAdminPublicationCategories(
      {
        page: filters.page,
        pageSize: filters.pageSize,
        search: filters.search.trim() || undefined
      },
      { signal }
    )

    return mapPublicationCategoryPageResponse(response)
  } catch (error) {
    throw mapPublicationCategorySourceError(error)
  }
}

/**
 * Загружает полный список категорий для select-полей публикаций.
 */
export const listAllPublicationCategories = async (
  signal?: AbortSignal
): Promise<AdminPublicationCategory[]> => {
  const categories: AdminPublicationCategory[] = []
  let page = 1

  while (true) {
    const result = await listPublicationCategories({ page, pageSize: 100, search: '' }, signal)

    categories.push(...result.items)

    if (categories.length >= result.total || isEmptyArray(result.items)) {
      return categories
    }

    page += 1
  }
}

/**
 * Создаёт категорию публикаций.
 */
export const createPublicationCategory = async (
  input: PublicationCategoryInput,
  signal?: AbortSignal
): Promise<AdminPublicationCategory> => {
  try {
    const response: unknown = await adminRestApi.publicationCategories.createAdminPublicationCategory(
      { name: input.name.trim(), slug: input.slug.trim() },
      { signal }
    )

    return mapAdminPublicationCategoryResponse(response)
  } catch (error) {
    throw mapPublicationCategorySourceError(error)
  }
}

/**
 * Обновляет категорию при совпадении optimistic version.
 */
export const updatePublicationCategory = async (
  categoryId: string,
  expectedVersion: number,
  input: PublicationCategoryInput,
  signal?: AbortSignal
): Promise<AdminPublicationCategory> => {
  try {
    const response: unknown = await adminRestApi.publicationCategories.updateAdminPublicationCategory(
      { objectGuid: categoryId },
      {
        expectedVersion,
        name: input.name.trim(),
        slug: input.slug.trim()
      },
      { signal }
    )

    return mapAdminPublicationCategoryResponse(response)
  } catch (error) {
    throw mapPublicationCategorySourceError(error)
  }
}

/**
 * Удаляет пустую категорию при совпадении optimistic version.
 */
export const deletePublicationCategory = async (
  categoryId: string,
  expectedVersion: number,
  signal?: AbortSignal
): Promise<void> => {
  try {
    await adminRestApi.publicationCategories.deleteAdminPublicationCategory(
      { objectGuid: categoryId },
      { expectedVersion },
      { signal }
    )
  } catch (error) {
    throw mapPublicationCategorySourceError(error)
  }
}
