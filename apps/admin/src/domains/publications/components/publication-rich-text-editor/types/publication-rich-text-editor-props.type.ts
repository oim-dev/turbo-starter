import type { RichTextDocument } from '@biocad/rich-text'
import type { ComponentPropsWithoutRef } from 'react'

import type { PublicationArtifact } from '../../../types/publication.type'

/**
 * Собственные параметры rich-text редактора публикации.
 */
export type PublicationRichTextEditorParams = {
  /** Готовые артефакты сохранённой публикации. */
  artifacts: PublicationArtifact[]
  /** Заголовок для контекста AI-помощника. */
  title: string
  /** Текущий канонический документ. */
  value: RichTextDocument
  /** Передаёт каноническое изменение форме публикации. */
  onChange: (value: RichTextDocument) => void
}

/**
 * Атрибуты корневого элемента редактора.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'onChange'>

/**
 * Props rich-text редактора публикации.
 */
export type PublicationRichTextEditorProps = RootAttrs & PublicationRichTextEditorParams
