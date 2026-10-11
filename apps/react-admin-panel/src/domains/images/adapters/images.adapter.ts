import { backendAdminApi } from 'infra/backend-admin-api'
import type { AdminImageListParams, CreateImageUploadDto, UpdateImageDto } from 'infra/backend-admin-api'
import { uploadPresignedFile } from 'infra/presigned-upload'
import { ImageError } from '../errors/image.error'
import { normalizeImageFolder, normalizeImageTags } from '../helpers/image-presentation'
import { mapImage, mapImageFacets, mapImagePage } from '../mappers/image.mapper'
import { mapOriginalLink, mapUploadTarget } from '../mappers/image-transfer.mapper'
import { classifyImageError } from '../source-errors/classify-image-error'
import type { ImageClassification, ImageFacets, ImageFilters, ImagePage, ImageUploadInput, ProjectImage } from '../types/image.type'

/**
 * Получает страницу общей галереи через административный SDK.
 */
export const getImages = async (filters: ImageFilters): Promise<ImagePage> => {
  const query: AdminImageListParams = {
    page: filters.page,
    pageSize: filters.pageSize,
    search: filters.search || undefined,
    folder: filters.folder ?? undefined,
    tag: filters.tag ?? undefined,
    status: filters.status ?? undefined,
    unfiled: filters.unfiled || undefined
  }
  try {
    return mapImagePage(await backendAdminApi.images.adminImageList(query))
  } catch (error) {
    throw classifyImageError(error, true)
  }
}

/**
 * Получает категории всех доступных изображений.
 */
export const getImageFacets = async (): Promise<ImageFacets> => {
  try {
    return mapImageFacets(await backendAdminApi.images.adminImageFacets())
  } catch (error) {
    throw classifyImageError(error, true)
  }
}

/**
 * Получает свежие подробности без запуска обработки.
 */
export const getImage = async (id: string): Promise<ProjectImage> => {
  try {
    return mapImage(await backendAdminApi.images.adminImageGet({ id }))
  } catch (error) {
    throw classifyImageError(error, true)
  }
}

/**
 * Читает наблюдаемые задания небольшими группами, не создавая таймеров на изображения.
 */
export const getProcessingImages = async (ids: readonly string[]): Promise<ProjectImage[]> => {
  const images: ProjectImage[] = []
  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = await Promise.all(ids.slice(offset, offset + 4).map(getImage))
    images.push(...batch)
  }
  return images
}

/**
 * Сохраняет только название и классификацию изображения.
 */
export const updateImage = async (id: string, input: ImageClassification): Promise<ProjectImage> => {
  const body: UpdateImageDto = {
    title: input.title.trim(),
    folder: normalizeImageFolder(input.folder),
    tags: normalizeImageTags(input.tags)
  }
  try {
    return mapImage(await backendAdminApi.images.adminImageUpdate({ id }, body))
  } catch (error) {
    throw classifyImageError(error)
  }
}

/**
 * Повторяет исходное неудавшееся задание по явному действию пользователя.
 */
export const retryImage = async (id: string): Promise<ProjectImage> => {
  try {
    return mapImage(await backendAdminApi.images.adminImageRetry({ id }))
  } catch (error) {
    throw classifyImageError(error)
  }
}

/**
 * Получает приватную временную ссылку только для императивного скачивания.
 */
export const getImageOriginal = async (id: string): Promise<string> => {
  try {
    return mapOriginalLink(await backendAdminApi.images.adminImageOriginal({ id }))
  } catch (error) {
    throw classifyImageError(error)
  }
}

/**
 * Создаёт загрузку, передаёт оригинал в S3 без JWT и подтверждает фоновую обработку.
 */
export const uploadImage = async (
  file: File,
  input: ImageUploadInput,
  onProgress: (progress: number) => void,
  signal: AbortSignal
): Promise<ProjectImage> => {
  const contentType = file.type
  if (contentType !== 'image/jpeg' && contentType !== 'image/png' && contentType !== 'image/webp') {
    throw new ImageError('INVALID_INPUT')
  }
  const body: CreateImageUploadDto = {
    filename: file.name,
    contentType,
    byteSize: file.size,
    folder: normalizeImageFolder(input.folder),
    tags: normalizeImageTags(input.tags)
  }
  try {
    const created = await backendAdminApi.images.adminImageCreateUpload(body, { signal })
    const image = mapImage(created.image)
    const target = mapUploadTarget(created.upload)
    await uploadPresignedFile({ ...target, file, signal, onProgress })
    return mapImage(await backendAdminApi.images.adminImageComplete({ id: image.id }, { signal }))
  } catch (error) {
    if (signal.aborted) throw error
    throw classifyImageError(error)
  }
}
