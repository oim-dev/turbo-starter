import { Container, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import type { HomeScreenProps } from './types/home-screen-props.type'
import styles from './styles/home.module.css'

/**
 * Показывает нейтральную стартовую страницу приложения.
 *
 * Используется для:
 *  - серверного отображения главной страницы без обращения к API
 */
export const HomeScreen = (props: HomeScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <Container size="sm">
        <Stack gap="md">
          <Text size="sm" c="gray.7">Next.js · Mantine · Unit Architecture</Text>
          <Title order={1} className={styles.title}>Стартовое приложение</Title>
          <Text size="lg" c="gray.7">
            Основа для нового проекта. Эта страница работает самостоятельно и не обращается к API.
          </Text>
        </Stack>
      </Container>
    </main>
  )
}
