/**
 * Приватный ключ подробностей изображения.
 */
export const getImageKey = (
  userId: string | null,
  imageId: string | null
): readonly ['private', string, 'images/detail', string] | null => {
  return userId === null || imageId === null ? null : ['private', userId, 'images/detail', imageId] as const
}
