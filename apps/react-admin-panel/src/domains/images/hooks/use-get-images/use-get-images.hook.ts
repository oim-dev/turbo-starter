import useSWR, { useSWRConfig } from 'swr'
import type { SWRResponse } from 'swr'
import { useRef } from 'react'
import { useGetCurrentUser } from 'domains/management/auth'
import { isNonEmptyArray } from 'shared/value-predicates'
import { getImages, getProcessingImages } from '../../adapters/images.adapter'
import type { ImageError } from '../../errors/image.error'
import { isImagePending } from '../../helpers/image-presentation'
import { getLatestImage } from '../../helpers/get-latest-image'
import type { ImageFilters, ImagePage, ProjectImage } from '../../types/image.type'
import type { ImageProcessingWatch } from '../../types/image-processing-watch.type'
import { getImagesKey } from './get-images-key'
import { getImageKey } from '../use-get-image/get-image-key'
import { getImageFacetsKey } from '../use-get-image-facets/get-image-facets-key'

/**
 * Получает список с единым циклом наблюдения за страницей, подробностями и собственными заданиями.
 */
export const useGetImages = (
  filters: ImageFilters,
  selectedId: string | null,
  hasPendingDetails: boolean,
  processing: ImageProcessingWatch
): SWRResponse<ImagePage, ImageError> => {
  const { mutate } = useSWRConfig()
  const requestGeneration = useRef(0)
  const profile = useGetCurrentUser()
  const canRead = profile.error === undefined && profile.data?.permissions.includes('images.read') === true
  const key = getImagesKey(canRead ? profile.data?.id ?? null : null, filters)
  const hasPendingOperations = isNonEmptyArray(processing.pendingIds)
  /**
   * Сначала проверяет свои задания, затем получает список — терминальный переход уже попадёт в ready-выдачу.
   * Одна итерация ожидает все GET; следующий polling не создаёт параллельный обход того же набора.
   */
  const fetchImages = async (): Promise<ImagePage> => {
    const generation = ++requestGeneration.current
    const watchedIds = [...new Set([
      ...processing.pendingIds,
      ...(selectedId === null ? [] : [selectedId])
    ])]
    const watchedImages = await getProcessingImages(watchedIds)
    const page = await getImages(filters)
    if (generation !== requestGeneration.current) return page
    await Promise.all(watchedImages.map((image) => {
      return mutate<ProjectImage>(
        getImageKey(profile.data?.id ?? null, image.id),
        (current) => generation === requestGeneration.current ? getLatestImage(current, image) : current,
        { revalidate: false }
      )
    }))
    if (generation !== requestGeneration.current) return page
    const settledIds = watchedImages
      .filter((image) => image.status === 'ready' || image.status === 'failed')
      .map((image) => image.id)
    processing.onSettled(settledIds)
    return page
  }
  return useSWR<ImagePage, ImageError>(key, fetchImages, {
    shouldRetryOnError: false,
    keepPreviousData: false,
    refreshInterval: (page) => page?.items.some(isImagePending) || hasPendingDetails || hasPendingOperations ? 2500 : 0,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    onSuccess: (page) => {
      void mutate(getImageFacetsKey(profile.data?.id ?? null))
      const detailKey = getImageKey(profile.data?.id ?? null, selectedId)
      if (detailKey === null) return
      const image = page.items.find((candidate) => candidate.id === selectedId)
      if (image !== undefined) {
        void mutate<ProjectImage>(detailKey, (current) => getLatestImage(current, image), { revalidate: false })
        return
      }
    }
  })
}
