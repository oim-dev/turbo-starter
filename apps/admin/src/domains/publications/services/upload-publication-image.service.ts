import { isOneOf } from '@biocad/value-predicates'

import { adminRestApi } from 'infra/admin-rest-api'
import { uploadPresignedForm } from 'infra/presigned-upload'
import { PublicationError, mapPublicationSourceError } from '../errors/publication.error'
import {
  mapPublicationUploadIntentResponse,
  mapReadyPublicationArtifactResponse
} from '../mappers/publication-response.mapper'
import type { PublicationArtifact } from '../types/publication.type'
import type { PublicationUploadIntent } from '../types/publication-upload.type'

const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/**
 * Runtime-настройки одной загрузки изображения публикации.
 */
export type UploadPublicationImageOptions = {
  /** Получает суммарный прогресс цепочки intent -> storage -> processing. */
  onProgress?: (progress: number) => void
  /** Отменяет всю цепочку загрузки. */
  signal?: AbortSignal
}

/**
 * Зависимости сценария загрузки изображения публикации.
 */
export type UploadPublicationImageDependencies = {
  /** Завершает серверную проверку загруженного объекта. */
  completeUpload: (artifactId: string, signal?: AbortSignal) => Promise<PublicationArtifact>
  /** Создаёт server-side media artifact и подписанную форму. */
  createUploadIntent: (
    file: File,
    signal?: AbortSignal
  ) => Promise<PublicationUploadIntent>
  /** Выполняет прямой browser upload без участия UI. */
  uploadFile: (
    intent: PublicationUploadIntent,
    file: File,
    signal?: AbortSignal,
    onProgress?: (progress: number) => void
  ) => Promise<void>
}

/**
 * Создаёт атомарный сценарий intent -> storage POST -> complete.
 */
export const createUploadPublicationImage = (
  dependencies: UploadPublicationImageDependencies
): ((file: File, options?: UploadPublicationImageOptions) => Promise<PublicationArtifact>) => {
  return async (file: File, options?: UploadPublicationImageOptions): Promise<PublicationArtifact> => {
    if (!isOneOf(file.type, IMAGE_CONTENT_TYPES) || file.size < 1 || file.size > MAX_IMAGE_SIZE) {
      throw new PublicationError('INVALID_UPLOAD')
    }

    try {
      options?.onProgress?.(2)
      const intent = await dependencies.createUploadIntent(file, options?.signal)
      options?.onProgress?.(5)
      await dependencies.uploadFile(
        intent,
        file,
        options?.signal,
        progress => options?.onProgress?.(Math.round(5 + progress * 0.8))
      )
      options?.onProgress?.(90)
      const artifact = await dependencies.completeUpload(intent.artifactId, options?.signal)
      options?.onProgress?.(100)

      return artifact
    } catch (error) {
      throw mapPublicationSourceError(error, 'INVALID_UPLOAD')
    }
  }
}

/**
 * Configured browser-сценарий загрузки изображения публикации.
 */
export const uploadPublicationImage = createUploadPublicationImage({
  completeUpload: async (artifactId, signal) => {
    const response: unknown = await adminRestApi.mediaArtifacts.completeAdminMediaArtifactUpload(
      { objectGuid: artifactId },
      { signal }
    )

    return mapReadyPublicationArtifactResponse(response)
  },
  createUploadIntent: async (file, signal) => {
    const response: unknown = await adminRestApi.mediaArtifacts.createAdminMediaArtifactUploadIntent(
      {
        contentType: file.type as (typeof IMAGE_CONTENT_TYPES)[number],
        size: file.size
      },
      { signal }
    )

    return mapPublicationUploadIntentResponse(response)
  },
  uploadFile: async (intent, file, signal, onProgress) => {
    await uploadPresignedForm({
      fields: intent.fields,
      file,
      onProgress,
      signal,
      url: intent.url
    })
  }
})
