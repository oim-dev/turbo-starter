import {
  Alert,
  Button,
  Center,
  Container,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title
} from '@mantine/core'
import { IconAlertTriangle, IconLogin2, IconShieldLock } from '@tabler/icons-react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/use-auth.hook'
import { getAuthReturnTo } from '../../lib/get-auth-return-to'
import { startAuthLogin } from '../../services/auth.service'
import styles from './styles/auth-login.module.css'

/**
 * Страница входа в панель администрирования.
 *
 * Используется для:
 *  - запуска входа через Keycloak для anonymous-сессии
 *  - возврата authenticated-пользователя на запрошенный маршрут
 */
export const AuthLogin = () => {
  const { hasLogoutError, state } = useAuth()
  const { search } = useLocation()
  const returnTo = getAuthReturnTo(search)

  /**
   * Начинает OIDC login redirect с безопасным внутренним returnTo.
   */
  const handleLogin = (): void => {
    startAuthLogin(returnTo)
  }

  if (state.status === 'authenticated') {
    return <Navigate replace to={returnTo} />
  }

  return (
    <main className={styles.root} aria-labelledby="auth-title">
      <Center mih="100vh" px="md" py="xl">
        <Container size={440} w="100%">
          <Paper className={styles.card} p="xl" radius="xl" shadow="xl" withBorder>
            <Stack align="center" gap="lg">
              <ThemeIcon radius="xl" size={64}>
                <IconShieldLock size={32} stroke={1.5} />
              </ThemeIcon>
              <Stack align="center" gap={6}>
                <Text className={styles.eyebrow} c="var(--mantine-primary-color-light-color)" fw={700} size="xs">
                  BIOCAD ADMIN
                </Text>
                <Title id="auth-title" order={1} ta="center">
                  Панель администрирования
                </Title>
                <Text c="dimmed" maw={320} size="sm" ta="center">
                  Управление внутренними сервисами и настройками платформы.
                </Text>
              </Stack>
              {hasLogoutError && (
                <Alert color="yellow" icon={<IconAlertTriangle />} title="Сессия закрыта локально">
                  Не удалось подтвердить ответ сервера при выходе. При необходимости войдите повторно.
                </Alert>
              )}
              <Button fullWidth leftSection={<IconLogin2 size={18} />} size="md" onClick={handleLogin}>
                Войти
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Center>
    </main>
  )
}
