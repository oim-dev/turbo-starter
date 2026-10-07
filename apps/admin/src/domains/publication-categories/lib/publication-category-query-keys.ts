import type { PublicationCategoryFilters } from '../types/publication-category.type'

/**
 * Стабильные React Query keys server state категорий.
 */
export const publicationCategoryQueryKeys = {
  all: ['publication-categories'] as const,
  lists: ['publication-categories', 'list'] as const,
  options: ['publication-categories', 'list', 'options'] as const,
  list: (filters: PublicationCategoryFilters) => ['publication-categories', 'list', filters] as const
}
