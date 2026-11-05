import { Text, Title } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import type { PageHeadingProps } from './types/page-heading-props.type'
import styles from './styles/page-heading.module.css'

/**
 * Задаёт визуальную иерархию заголовка и основного действия страницы.
 *
 * Используется для:
 *  - оформления заголовков настроек и списков
 */
export const PageHeading = (props: PageHeadingProps): JSX.Element => {
  const { title, description, eyebrow, action, className, ...rootAttrs } = props

  return (
    <header {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.copy}>
        <Text className={styles.eyebrow}>{eyebrow}</Text>
        <Title order={1} className={styles.title}>
          {title}
        </Title>
        <Text c="dimmed" mt={8} lh={1.6}>
          {description}
        </Text>
      </div>
      {action}
    </header>
  )
}
