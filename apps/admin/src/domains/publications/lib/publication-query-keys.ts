import type { PublicationFilters } from '../types/publication.type'

/**
 * Стабильные cache keys server state публикаций.
 */
export const publicationQueryKeys = {
  all: ['publications'] as const,
  detail: (publicationId: string) => ['publications', 'detail', publicationId] as const,
  lists: ['publications', 'list'] as const,
  list: (filters: PublicationFilters) => ['publications', 'list', filters] as const
}
