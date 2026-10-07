import cl from 'clsx'
import type { JSX } from 'react'
import { isDefined } from 'shared/lib/value-predicates'
import type { PageHeadingProps } from './types/page-heading-props.type'
import styles from './styles/page-heading.module.css'

/**
 * Показывает заголовок и действия раздела.
 *
 * Используется для:
 *  - единого оформления начала страницы
 */
export const PageHeading = (props: PageHeadingProps): JSX.Element => {
  const { title, description, eyebrow, children, className, ...rootAttrs } = props

  return (
    <header {...rootAttrs} className={cl(styles.root, className)}>
      <div>
        {isDefined(eyebrow) && (
          <p className={styles.eyebrow}>{eyebrow}</p>
        )}
        <h1 className={styles.title}>{title}</h1>
        {isDefined(description) && (
          <p className={styles.description}>{description}</p>
        )}
      </div>
      {children}
    </header>
  )
}
