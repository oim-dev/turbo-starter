import type { ImageFilters } from '../../types/image.type'

/**
 * Приватный ключ страницы включает все фильтры и текущую identity.
 */
export const getImagesKey = (
  userId: string | null,
  filters: ImageFilters
): readonly ['private', string, 'images/list', ImageFilters] | null => {
  return userId === null ? null : ['private', userId, 'images/list', filters] as const
}
