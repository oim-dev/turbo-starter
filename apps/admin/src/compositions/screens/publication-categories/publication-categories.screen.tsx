import cl from 'clsx'

import { PublicationCategoriesManager } from 'domains/publication-categories/client'
import type { PublicationCategoriesScreenProps } from './types/publication-categories-screen-props.type'
import styles from './styles/publication-categories.module.css'

/**
 * Размещает экран PublicationCategories в layout приложения.
 */
export const PublicationCategoriesScreen = (props: PublicationCategoriesScreenProps) => {
  const { className, ...rootAttrs } = props

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <PublicationCategoriesManager />
    </main>
  )
}
