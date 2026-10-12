import type { FileFilters } from '../../types/file.type'

/**
 * Изолирует фильтрованный список по текущей identity.
 */
export const getFilesKey = (userId: string | null, filters: FileFilters): readonly ['private', string, 'files/list', FileFilters] | null => {
  return userId === null ? null : ['private', userId, 'files/list', filters]
}
