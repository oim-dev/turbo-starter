import type { ProjectImage } from '../types/image.type'

/**
 * Не заменяет свежие метаданные запоздавшим результатом наблюдения.
 */
export const getLatestImage = (current: ProjectImage | undefined, received: ProjectImage): ProjectImage => {
  if (current !== undefined && Date.parse(current.updatedAt) > Date.parse(received.updatedAt)) return current
  return received
}
