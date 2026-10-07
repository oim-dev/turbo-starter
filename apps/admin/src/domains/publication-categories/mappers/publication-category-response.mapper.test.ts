import { describe, expect, it } from 'vitest'

import {
  mapAdminPublicationCategoryResponse,
  mapPublicationCategoryPageResponse,
  parsePublicationCategory
} from './publication-category-response.mapper'

const CATEGORY_RESPONSE = {
  createdAt: '2026-08-20T10:00:00.000Z',
  name: 'Новости компании',
  objectGuid: '550e8400-e29b-41d4-a716-446655440000',
  publicationCount: 3,
  slug: 'company-news',
  updatedAt: '2026-08-21T10:00:00.000Z',
  version: 2
}

describe('publication category response mapper', () => {
  it('не пропускает административные source fields в публичную модель', () => {
    expect(parsePublicationCategory(CATEGORY_RESPONSE)).toEqual({
      id: CATEGORY_RESPONSE.objectGuid,
      name: CATEGORY_RESPONSE.name,
      slug: CATEGORY_RESPONSE.slug
    })
  })

  it('сохраняет редакционные метаданные только в административной модели', () => {
    expect(mapAdminPublicationCategoryResponse(CATEGORY_RESPONSE)).toEqual({
      createdAt: CATEGORY_RESPONSE.createdAt,
      id: CATEGORY_RESPONSE.objectGuid,
      name: CATEGORY_RESPONSE.name,
      publicationCount: CATEGORY_RESPONSE.publicationCount,
      slug: CATEGORY_RESPONSE.slug,
      updatedAt: CATEGORY_RESPONSE.updatedAt,
      version: CATEGORY_RESPONSE.version
    })
  })

  it('отклоняет malformed страницу как TypeError', () => {
    expect(() => mapPublicationCategoryPageResponse({ items: [{}], page: 1, pageSize: 20, total: 1 }))
      .toThrow(TypeError)
  })
})
