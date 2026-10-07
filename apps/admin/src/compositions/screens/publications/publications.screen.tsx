import cl from 'clsx'

import { PublicationsList } from 'domains/publications/client'
import type { PublicationsScreenProps } from './types/publications-screen-props.type'
import styles from './styles/publications.module.css'

/**
 * Экран управления публикациями.
 *
 * Используется для:
 *  - размещения доменного списка публикаций в основном layout
 */
export const PublicationsScreen = (props: PublicationsScreenProps) => {
  const { className, ...rootAttrs } = props

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <PublicationsList />
    </main>
  )
}
