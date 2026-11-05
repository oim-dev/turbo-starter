import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { getImage } from '../../adapters/images.adapter'
import type { ImageError } from '../../errors/image.error'
import type { ProjectImage } from '../../types/image.type'
import { getImageKey } from './get-image-key'

/**
 * Предоставляет подробности выбранного изображения без отдельного polling.
 */
export const useGetImage = (imageId: string | null): SWRResponse<ProjectImage, ImageError> => {
  const profile = useGetCurrentUser()
  const canRead = profile.error === undefined && profile.data?.permissions.includes('images.read') === true
  const key = getImageKey(canRead ? profile.data?.id ?? null : null, imageId)
  return useSWR<ProjectImage, ImageError>(key, () => getImage(imageId ?? ''), {
    shouldRetryOnError: false,
    keepPreviousData: false
  })
}
