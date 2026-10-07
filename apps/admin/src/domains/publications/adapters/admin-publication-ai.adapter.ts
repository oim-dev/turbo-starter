import { adminRestApi } from 'infra/admin-rest-api'
import type { PublicationAiDependency } from '../dependencies/publication-ai.dependency'
import { mapPublicationSourceError } from '../errors/publication.error'
import { mapPublicationAiResponse } from '../mappers/publication-response.mapper'

/**
 * Подключает доменный AI dependency к configured Admin SDK operation.
 */
export const adminPublicationAiDependency: PublicationAiDependency = {
  transformText: async (input, signal) => {
    try {
      const response: unknown = await adminRestApi.publicationAi.transformAdminPublicationText(
        input,
        { signal }
      )

      return mapPublicationAiResponse(response)
    } catch (error) {
      throw mapPublicationSourceError(error, 'AI_UNAVAILABLE')
    }
  }
}
