import cl from 'clsx'

import { PublicationEditor } from 'domains/publications/client'
import type { PublicationEditScreenProps } from './types/publication-edit-screen-props.type'
import styles from './styles/publication-edit.module.css'

/**
 * Экран редактирования публикации.
 *
 * Используется для:
 *  - размещения редактора существующей публикации в основном layout
 */
export const PublicationEditScreen = (props: PublicationEditScreenProps) => {
  const { publicationId, className, ...rootAttrs } = props

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <PublicationEditor mode="edit" publicationId={publicationId} />
    </main>
  )
}
