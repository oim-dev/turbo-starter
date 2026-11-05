/**
 * Ключ истории версий документа внутри приватной identity.
 */
export const getFileVersionsKey = (userId: string | null, id: string | null): readonly ['private', string, 'files/versions', string] | null => {
  return userId === null || id === null ? null : ['private', userId, 'files/versions', id]
}
