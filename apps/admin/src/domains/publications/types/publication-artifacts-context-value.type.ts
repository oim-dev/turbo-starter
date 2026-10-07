import type { PublicationArtifact } from './publication.type'

/**
 * Runtime-возможности node views для изображений публикации.
 */
export type PublicationArtifactsContextValue = {
  /** Готовые артефакты по стабильному UUID. */
  artifactsById: ReadonlyMap<string, PublicationArtifact>
  /** Загружает и регистрирует новый артефакт в текущей editor session. */
  uploadImage: (
    file: File,
    options?: {
      /** Получает суммарный прогресс загрузки и обработки. */
      onProgress?: (progress: number) => void
      /** Отменяет загрузку при завершении lifecycle node view. */
      signal?: AbortSignal
    }
  ) => Promise<PublicationArtifact>
}
