import { createEmptyRichTextDocument, hasRichTextContent } from '@biocad/rich-text'
import { isNonEmptyString, isNotDefined } from '@biocad/value-predicates'

import type { Publication, PublicationDraft } from '../types/publication.type'

/**
 * Создаёт исходное состояние формы новой публикации.
 */
export const createEmptyPublicationDraft = (): PublicationDraft => {
  return {
    body: createEmptyRichTextDocument(),
    categoryId: '',
    cover: null,
    coverAlt: '',
    excerpt: '',
    slug: '',
    title: ''
  }
}

/**
 * Преобразует сохранённую публикацию в редактируемые поля формы.
 */
export const createPublicationDraft = (publication: Publication): PublicationDraft => {
  return {
    body: publication.body,
    categoryId: publication.category.id,
    cover: publication.cover,
    coverAlt: publication.coverAlt,
    excerpt: publication.excerpt,
    slug: publication.slug,
    title: publication.title
  }
}

/**
 * Определяет наличие несохранённых изменений редактора.
 */
export const isPublicationDraftDirty = (
  draft: PublicationDraft,
  savedDraft: PublicationDraft
): boolean => {
  return JSON.stringify(draft) !== JSON.stringify(savedDraft)
}

/**
 * Проверяет минимальные поля, обязательные для ручного сохранения draft.
 */
export const getPublicationDraftValidationError = (draft: PublicationDraft): string | null => {
  if (!isNonEmptyString(draft.title)) {
    return 'Укажите заголовок публикации.'
  }

  if (!isNonEmptyString(draft.slug)) {
    return 'Укажите slug публикации.'
  }

  if (!isNonEmptyString(draft.categoryId)) {
    return 'Выберите категорию публикации.'
  }

  return null
}

/**
 * Returns actionable requirements that still block publication.
 */
export const getPublicationPublishValidationIssues = (
  draft: PublicationDraft
): string[] => {
  const issues: string[] = []

  if (!isNonEmptyString(draft.title)) {
    issues.push('Укажите заголовок.')
  }

  if (!isNonEmptyString(draft.slug)) {
    issues.push('Укажите slug.')
  }

  if (!isNonEmptyString(draft.categoryId)) {
    issues.push('Выберите категорию.')
  }

  if (!isNonEmptyString(draft.excerpt)) {
    issues.push('Заполните анонс.')
  }

  if (isNotDefined(draft.cover)) {
    issues.push('Загрузите обложку.')
  }

  if (!isNonEmptyString(draft.coverAlt)) {
    issues.push('Добавьте альтернативный текст обложки.')
  }

  if (!hasRichTextContent(draft.body)) {
    issues.push('Добавьте текст публикации.')
  }

  return issues
}
