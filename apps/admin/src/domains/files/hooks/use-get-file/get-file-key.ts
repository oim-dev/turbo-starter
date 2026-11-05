/**
 * Изолирует подробности документа по identity и UUID.
 */
export const getFileKey = (userId: string | null, id: string | null): readonly ['private', string, 'files/detail', string] | null => {
  return userId === null || id === null ? null : ['private', userId, 'files/detail', id]
}
