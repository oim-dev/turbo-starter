import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана PublicationEdit.
 */
export type PublicationEditScreenParams = {
  /** UUID редактируемой публикации. */
  publicationId: string
}

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Props экрана редактирования публикации.
 */
export type PublicationEditScreenProps = RootAttrs & PublicationEditScreenParams
