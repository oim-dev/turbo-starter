import { createContext } from 'react'

import type { PublicationArtifactsContextValue } from '../types/publication-artifacts-context-value.type'

/**
 * Отклоняет загрузку вне editor provider как ошибку сборки runtime graph.
 */
const rejectUnavailableImageUpload = async (): Promise<never> => {
  throw new Error('Publication image upload is unavailable outside the editor provider')
}

/**
 * Готовые артефакты, доступные runtime node views редактора.
 */
export const PublicationArtifactsContext = createContext<PublicationArtifactsContextValue>({
  artifactsById: new Map(),
  uploadImage: rejectUnavailableImageUpload
})
