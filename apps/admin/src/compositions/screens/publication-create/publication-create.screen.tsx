import cl from 'clsx'

import { PublicationEditor } from 'domains/publications/client'
import type { PublicationCreateScreenProps } from './types/publication-create-screen-props.type'
import styles from './styles/publication-create.module.css'

/**
 * Экран создания публикации.
 *
 * Используется для:
 *  - размещения нового draft в основном layout
 */
export const PublicationCreateScreen = (props: PublicationCreateScreenProps) => {
  const { className, ...rootAttrs } = props

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <PublicationEditor mode="create" />
    </main>
  )
}
