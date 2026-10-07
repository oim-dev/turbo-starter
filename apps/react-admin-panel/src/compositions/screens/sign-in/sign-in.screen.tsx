import { Card, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { SignInForm } from 'domains/auth'
import styles from './styles/sign-in.module.css'
import type { SignInScreenProps } from './types/sign-in-screen-props.type'

/**
 * Размещает доменную форму входа в публичном экране административной панели.
 *
 * Используется для:
 *  - отображения заголовка, пояснений и формы авторизации
 */
export const SignInScreen = (props: SignInScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <Card className={styles.card} padding="xl" radius="md" withBorder>
        <Stack gap="xl">
          <Stack gap="xs">
            <Text c="dimmed" fw={600} size="sm">Панель администратора</Text>
            <Title order={1} size="h2">Вход в панель</Title>
            <Text c="dimmed" size="sm">
              Используйте учётную запись администратора.
            </Text>
          </Stack>

          <SignInForm />

          <Text c="dimmed" size="sm" ta="center">
            Доступ только для администраторов.
          </Text>
        </Stack>
      </Card>
    </main>
  )
}
