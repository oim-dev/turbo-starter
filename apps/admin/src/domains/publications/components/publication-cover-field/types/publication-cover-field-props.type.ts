import type { ComponentPropsWithoutRef } from 'react'

import type { PublicationArtifact } from '../../../types/publication.type'

/**
 * Собственные параметры поля обложки.
 */
export type PublicationCoverFieldParams = {
  /** Альтернативный текст текущей обложки. */
  alt: string
  /** Текущий completed cover artifact. */
  value: PublicationArtifact | null
  /** Передаёт изменение обложки форме публикации. */
  onChange: (value: PublicationArtifact | null) => void
}

/**
 * Атрибуты корневого элемента поля обложки.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'onChange'>

/**
 * Props поля обложки публикации.
 */
export type PublicationCoverFieldProps = RootAttrs & PublicationCoverFieldParams
