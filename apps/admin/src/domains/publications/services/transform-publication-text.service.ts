import { isNonEmptyString } from '@biocad/value-predicates'

import { adminPublicationAiDependency } from '../adapters/admin-publication-ai.adapter'
import type { PublicationAiDependency } from '../dependencies/publication-ai.dependency'
import { PublicationError } from '../errors/publication.error'
import type { PublicationAiInput } from '../types/publication.type'

/**
 * Строит ограниченный document context для AI dependency.
 */
const createAiContext = (input: PublicationAiInput): string | undefined => {
  const documentContext = isNonEmptyString(input.selection) ? input.document.trim() : ''
  const toneContext = input.action === 'tone'
    ? 'Перепиши текст в нейтральном профессиональном тоне для корпоративного медицинского сайта.'
    : ''
  const context = [toneContext, documentContext].filter(isNonEmptyString).join('\n\n')

  return isNonEmptyString(context) ? context.slice(0, 4_000) : undefined
}

/**
 * Создаёт доменный AI-сценарий поверх source-neutral dependency.
 */
export const createTransformPublicationText = (
  dependency: PublicationAiDependency
): ((input: PublicationAiInput, signal?: AbortSignal) => Promise<string>) => {
  return (input: PublicationAiInput, signal?: AbortSignal): Promise<string> => {
    const selectedText = input.selection.trim()
    const title = input.title.trim()

    if (!isNonEmptyString(selectedText) || selectedText.length > 50_000) {
      throw new PublicationError('INVALID_DOCUMENT')
    }

    return dependency.transformText(
      {
        action: input.action === 'tone' ? 'rewrite' : input.action,
        context: createAiContext(input),
        selectedText,
        title: isNonEmptyString(title) ? title : undefined
      },
      signal
    )
  }
}

/**
 * Configured AI-сценарий редактора публикаций.
 */
export const transformPublicationText = createTransformPublicationText(
  adminPublicationAiDependency
)
