import { AppShell, Container } from '@mantine/core'
import cl from 'clsx'

import { Footer } from '../footer'
import type { ContentProps } from './types/content-props.type'
import styles from './styles/content.module.css'

/**
 * Основная область содержимого layout.
 *
 * Используется для:
 *  - размещения экранов активного маршрута
 *  - фиксации footer после содержимого страницы
 */
export const Content = (props: ContentProps) => {
  const { children, className, ...rootAttrs } = props

  return (
    <AppShell.Main {...rootAttrs} className={cl(styles.root, className)} component="div">
      <Container className={styles.wrapper} fluid>
        {children}
      </Container>
      <Footer />
    </AppShell.Main>
  )
}
