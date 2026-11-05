import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { getImageFacets } from '../../adapters/images.adapter'
import type { ImageError } from '../../errors/image.error'
import type { ImageFacets } from '../../types/image.type'
import { getImageFacetsKey } from './get-image-facets-key'

/**
 * Получает доступную классификацию в кеше текущего аккаунта.
 */
export const useGetImageFacets = (): SWRResponse<ImageFacets, ImageError> => {
  const profile = useGetCurrentUser()
  const canRead = profile.error === undefined && profile.data?.permissions.includes('images.read') === true
  const key = getImageFacetsKey(canRead ? profile.data?.id ?? null : null)
  return useSWR<ImageFacets, ImageError>(key, getImageFacets, { shouldRetryOnError: false })
}
