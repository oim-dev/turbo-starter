/**
 * Ключ классификации всей библиотеки текущего пользователя.
 */
export const getFileFacetsKey = (userId: string | null): readonly ['private', string, 'files/facets'] | null => {
  return userId === null ? null : ['private', userId, 'files/facets']
}
