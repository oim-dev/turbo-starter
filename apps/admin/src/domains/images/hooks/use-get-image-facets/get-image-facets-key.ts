/**
 * Приватный ключ категорий всей медиатеки.
 */
export const getImageFacetsKey = (userId: string | null): readonly ['private', string, 'images/facets'] | null => {
  return userId === null ? null : ['private', userId, 'images/facets'] as const
}
