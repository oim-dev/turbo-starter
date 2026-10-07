import { Text, Title } from '@mantine/core'
import cl from 'clsx'
import Link from 'next/link'
import type { JSX } from 'react'
import type { SystemStateScreenProps } from './types/system-state-screen-props.type'
import styles from './styles/system-state.module.css'

/**
 * Показывает нейтральное системное состояние маршрута.
 *
 * Используется для:
 *  - отображения отсутствующей страницы и ошибки рендеринга
 */
export const SystemStateScreen = (props: SystemStateScreenProps): JSX.Element => {
  const { kind, children, className, ...rootAttrs } = props
  const titleMap = { 'not-found': 'Страница не найдена', error: 'Не удалось открыть страницу' }
  const descriptionMap = {
    'not-found': 'Проверьте адрес или вернитесь на главную страницу.',
    error: 'Попробуйте ещё раз или вернитесь на главную страницу.'
  }
  const title = titleMap[kind]
  const description = descriptionMap[kind]

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <Title order={1} className={styles.title}>{title}</Title>
      <Text c="gray.7" className={styles.description}>{description}</Text>
      {children}
      <Link className={styles.link} href="/">
        На главную
      </Link>
    </main>
  )
}
