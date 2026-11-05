import { Button, Paper, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import styles from './styles/home.module.css'
import type { HomeScreenProps } from './types/home-screen-props.type'

/**
 * Показывает начальную страницу приватной панели без фиктивных данных.
 *
 * Используется для:
 *  - знакомства с текущими возможностями панели
 */
export const HomeScreen = (props: HomeScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <Stack gap="xl">
        <Stack gap="xs">
          <Text c="dimmed" size="sm">Главная</Text>
          <Title order={1}>Рабочее пространство</Title>
          <Text c="dimmed" maw={640}>
            Вы вошли в панель администратора. Здесь доступны сведения о вашей учётной записи.
          </Text>
        </Stack>

        <Paper p="xl" radius="md" withBorder>
          <Stack gap="sm" maw={640}>
            <Title order={2} size="h4">Ваша учётная запись</Title>
            <Text c="dimmed" size="sm">
              Посмотрите логин, роль и даты создания и обновления профиля.
              Данные загружаются из административного API.
            </Text>
            <Button component={Link} to="/profile">Открыть профиль</Button>
            <Text c="dimmed" size="sm">
              Завершить сеанс можно через меню аккаунта в правом верхнем углу.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    </section>
  )
}
