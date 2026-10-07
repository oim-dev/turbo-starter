import type { ComponentPropsWithoutRef } from 'react'

import type { PublicationCategory } from 'domains/publication-categories'
import type { Publication } from '../../../types/publication.type'

/**
 * Собственные параметры формы публикации.
 */
export type PublicationEditorFormParams = {
  /** Доступные категории публикаций. */
  categories: PublicationCategory[]
  /** Сохранённая публикация для edit mode. */
  publication: Publication | null
  /** Повторно получает актуальную server version после optimistic conflict. */
  onReloadLatest?: () => Promise<void>
}

/**
 * Атрибуты корневой секции формы.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Props формы публикации.
 */
export type PublicationEditorFormProps = RootAttrs & PublicationEditorFormParams
