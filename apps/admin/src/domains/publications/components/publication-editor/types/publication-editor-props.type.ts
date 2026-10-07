import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры создания новой публикации.
 */
type CreatePublicationEditorParams = {
  /** Режим нового draft. */
  mode: 'create'
  /** В create mode UUID отсутствует. */
  publicationId?: never
}

/**
 * Параметры редактирования существующей публикации.
 */
type EditPublicationEditorParams = {
  /** Режим существующей server version. */
  mode: 'edit'
  /** UUID редактируемой публикации. */
  publicationId: string
}

/**
 * Собственные параметры редактора публикации.
 */
export type PublicationEditorParams = CreatePublicationEditorParams | EditPublicationEditorParams

/**
 * Атрибуты корневой секции редактора.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Props редактора публикации.
 */
export type PublicationEditorProps = RootAttrs & PublicationEditorParams
